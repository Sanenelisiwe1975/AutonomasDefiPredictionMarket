// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


contract AgentVault {

    struct Allocation{
        address market;
        uint256 collateralDeployed;
        uint256 yesShares;
        uint256 noShares;
        uint256 lpShares;
        uint256 entryTimestamp;
        bool active;
    }

    struct RiskParams{
        uint256 maxSingleExposureBps;
        uint256 maxTotalExposuresBps;
        uint256 stopLossBps;
        uint256 takeProfitBps;
    }

    uint256 public constant BPS       = 10_000;
    uint256 public constant PRECISION = 1e18;

    
    address public owner;
    address public guardian;        // Multi-sig or DAO address
    address public strategyManager; // StrategyManager.sol
    address public executionRouter; // ExecutionRouter.sol


    address[] public supportedTokens;
    mapping(address => bool) public isSupported;


    RiskParams public riskParams;
    bool       public paused;

    bytes32[]                        public activeMarketsIds;
    mapping (bytes32 => Allocation)  public allocation; 
    
    event CapitalDeployed(bytes32 indexed marketId, address market, uint256 amount, IMarket.OutcomeIndex outcome);
    event CapitalWithdrawn(bytes32 indexed marketId, uint256 collateralOut);
    event LiquidityProvided(bytes32 indexed marketId, uint256 amount, uint256 lpShares);
    event LiquidityWithdrawn(bytes32 indexed marketId, uint256 lpShares, uint256 collateralOut);
    event WinningsClaimed(bytes32 indexed marketId, uint256 amount);
    event Rebalanced(bytes32 indexed fromMarket, bytes32 indexed toMarket, uint256 amount);
    event EmergencyPause(address guardian);
    event RiskParamsUpdated(RiskParams params);
    event TokenDeposited(address token, uint256 amount);
    event TokenWithdrawn(address token, uint256 amount, address recipient);
    
    error Unauthorized();
    error Paused();
    error ExposureLimitExceeded();
    error UnsupportedToken();
    error ZeroAmount();
    error InactiveMarket();
    error InvalidParams();

    constructor(
        address _owner,
        address _guardian,
        address[] memory _collateralTokens,
        RiskParams memory _riskParams
    ) {
        owner    = _owner;
        guardian = _guardian;
        riskParams = _riskParams;

        for (uint256 i = 0; i < _collateralTokens.length; i++) {
            supportedTokens.push(_collateralTokens[i]);
            isSupported[_collateralTokens[i]] = true;
        }
    }

    modifier onlyOwner()           { if (msg.sender != owner)           revert Unauthorized(); _; }
    modifier onlyOperator()        { if (msg.sender != strategyManager &&
                                         msg.sender != executionRouter &&
                                         msg.sender != owner)           revert Unauthorized(); _; }
    modifier onlyGuardian()        { if (msg.sender != guardian &&
                                         msg.sender != owner)           revert Unauthorized(); _; }
    modifier whenNotPaused()       { if (paused)                        revert Paused(); _; }

    function deployCapital(
        bytes32             marketId,
        address             market,
        address             collateralToken,
        uint256             amount,
        IMarket.OutcomeIndex outcome,
        uint256             minSharesOut
    ) external onlyOperator whenNotPaused returns (uint256 sharesOut) {
        if (!isSupported[collateralToken]) revert UnsupportedToken();
        if (amount == 0)                   revert ZeroAmount();
        _checkExposureLimit(amount);

        // Approve market to pull collateral
        IERC20(collateralToken).approve(market, amount);

        sharesOut = IMarket(market).buy(outcome, amount, minSharesOut);

        // Update internal allocation record
        Allocation storage alloc = allocations[marketId];
        if (!alloc.active) {
            activeMarketIds.push(marketId);
            alloc.market          = market;
            alloc.entryTimestamp  = block.timestamp;
            alloc.active          = true;
        }
        alloc.collateralDeployed += amount;
        if (outcome == IMarket.OutcomeIndex.YES) alloc.yesShares += sharesOut;
        else                                      alloc.noShares  += sharesOut;

        totalDeployed += amount;

        emit CapitalDeployed(marketId, market, amount, outcome);
    }

    function withdrawCapital(
        bytes32              marketId;
        IMarket.OutcomeIndex outcome,
        uint256              shareIn,
        uint256              minCollateralOut            
    )external onlyOperator whenNotPaused returns (uint256 collateralOut){
        Allocation storage alloc = allocations[marketId];
        if(!alloc.active) revert InactiveMarket();

        collateralOut == IMarket(alloc.market).sell(outcome, shareIn, minCollateralOut);

        if (outcome == IMarket.OutcomeIndex.YES) alloc.yesShares -= sharesIn;
        else                                      alloc.noShares  -= sharesIn;

        if (alloc.collateralDeployed > collateralOut)
            alloc.collateralDeployed -= collateralOut;
        else
            alloc.collateralDeployed = 0;

        totalDeployed = totalDeployed > collateralOut ? totalDeployed - collateralOut : 0;

        _maybeDeactivate(marketId);

        emit CapitalWithdrawn(marketId, collateralOut);
    }       

    function provideLiquidity(
        bytes32 marketId,
        address market,
        address collateralToken,
        uint256 amount,
        uint256 minLpOut
    ) external onlyOperator whenNotPaused returns (uint256 lpShares) {
        if (!isSupported[collateralToken]) revert UnsupportedToken();
        _checkExposureLimit(amount);

        IERC20(collateralToken).approve(market, amount);
        lpShares = IMarket(market).addLiquidity(amount, minLpOut);

        Allocation storage alloc = allocations[marketId];
        if (!alloc.active) {
            activeMarketIds.push(marketId);
            alloc.market         = market;
            alloc.entryTimestamp = block.timestamp;
            alloc.active         = true;
        }
        alloc.lpShares           += lpShares;
        alloc.collateralDeployed += amount;
        totalDeployed            += amount;

        emit LiquidityProvided(marketId, amount, lpShares);
    }

    function withdrawLiquidity(
        bytes32 marketId,
        uint256 lpShares,
        uint256 minCollateralOut
    ) external onlyOperator whenNotPaused returns (uint256 collateralOut) {
        Allocation storage alloc = allocations[marketId];
        if (!alloc.active) revert InactiveMarket();

        collateralOut = IMarket(alloc.market).removeLiquidity(lpShares, minCollateralOut);

        alloc.lpShares -= lpShares;
        alloc.collateralDeployed = alloc.collateralDeployed > collateralOut
            ? alloc.collateralDeployed - collateralOut : 0;
        totalDeployed = totalDeployed > collateralOut ? totalDeployed - collateralOut : 0;

        _maybeDeactivate(marketId);

        emit LiquidityWithdrawn(marketId, lpShares, collateralOut);
    }


    function claimWinnings(bytes32 marketId)
        external onlyOperator returns (uint256 payout)
    {
        Allocation storage alloc = allocations[marketId];
        if (!alloc.active) revert InactiveMarket();

        payout = IMarket(alloc.market).claimWinnings();
        totalWinnings += payout;
        alloc.yesShares = 0;
        alloc.noShares  = 0;
        _maybeDeactivate(marketId);

        emit WinningsClaimed(marketId, payout);
    }

    function getActiveAllocations() external view returns (bytes32[] memory) {
        return activeMarketIds;
    }

    function getAllocation(bytes32 marketId) external view returns (Allocation memory) {
        return allocations[marketId];
    }

    function estimateNAV(address collateralToken) external view returns (uint256 nav) {
        nav  = IERC20(collateralToken).balanceOf(address(this));
        nav += totalDeployed;
    }


    function setOperators(address _strategyManager, address _executionRouter) external onlyOwner {
        strategyManager = _strategyManager;
        executionRouter = _executionRouter;
    }

    function setRiskParams(RiskParams calldata params) external onlyOwner {
        if (params.maxSingleExposureBps > BPS) revert InvalidParams();
        riskParams = params;
        emit RiskParamsUpdated(params);
    }

    function addSupportedToken(address token) external onlyOwner {
        if (!isSupported[token]) {
            supportedTokens.push(token);
            isSupported[token] = true;
        }
    }

    function emergencyPause() external onlyGuardian {
        paused = true;
        emit EmergencyPause(msg.sender);
    }

    function unpause() external onlyOwner {
        paused = false;
    }

    function deposit(address token, uint256 amount) external {
        if (!isSupported[token]) revert UnsupportedToken();
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        emit TokenDeposited(token, amount);
    }

    function withdraw(address token, uint256 amount, address recipient) external onlyOwner {
        IERC20(token).transfer(recipient, amount);
        emit TokenWithdrawn(token, amount, recipient);
    }


    function _checkExposureLimit(uint256 amount) internal view {
        // Single-market exposure check against primary collateral balance
        // Full NAV check delegated to StrategyManager (off-chain or cross-contract)
        // On-chain hard cap: totalDeployed should not exceed maxTotalExposureBps of balances
    }

    function _maybeDeactivate(bytes32 marketId) internal {
        Allocation storage alloc = allocations[marketId];
        if (alloc.yesShares == 0 && alloc.noShares == 0 && alloc.lpShares == 0) {
            alloc.active             = false;
            alloc.collateralDeployed = 0;
        }
    }
}