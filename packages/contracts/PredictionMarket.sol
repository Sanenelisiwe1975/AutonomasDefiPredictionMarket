// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import ".../interfaces/IMarket.sol";
import "../interfaces/IERC20.sol";
import "./OutcomeToken.sol";

contract PredictionMarket  is IMarket{

    uint256 public constant PRECISION   = 1e18;
    uint256 public constant MAX_FEE_BPS = 500;   // 5 % cap
    uint256 public constant BPS         = 10_000;
  

    MarketInfo private _info;

    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    uint256 public b;

    uint256 internal qYes;
    uint256 internal qNo;

    uint256 public totalLpShares;
    mapping(address => uint256) public lpBalance;

    uint256 public pendingLpFees;

    address public immutable factory;
    address public immutable treasury;
    address public resolver;

    mapping(address => Position) private _positions;

    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }


    error MarketNotOpen();
    error MarketNotResolved();
    error MarketNotClosed();
    error InvalidOutcome();
    error SlippageExceeded();
    error InsufficientLiquidity();
    error Unauthorized();
    error ZeroAmount();
    error AlreadyResolved();
    error FeeTooHigh();

    contructor (
        bytes32 marketId,
        string memory question,
        uint64  closeAt,
        uint64  resolvesAt,
        address collateralToken,
        uint256 feeBps,
        uint256 liquidityParam,  
        address _factory,
        address _treasury,
        address _settlementToken,
        address _resolver,
    ){
        if (feeBps > MAX_FEE_BPS) revert FeeTooHigh();

        factory  = _factory;
        treasury = _treasury;
        resolver = _resolver;
        b        = liquidityParam;

        
        yesToken = new OutcomeToken(
            string(abi.encodePacked("YES-", question)),
            "YES",
            address(this)
        );
        noToken = new OutcomeToken(
            string(abi.encodePacked("NO-",  question)),
            "NO",
            address(this)
        );

        _info = MarketInfo({
            marketId:       marketId,
            question:       question,
            createdAt:      uint64(block.timestamp),
            closesAt:       closesAt,
            resolvesAt:     resolvesAt,
            state:          MarketState.OPEN,
            resolution:     OutcomeIndex.INVALID,
            collateralToken: collateralToken,
            yesToken:       address(yesToken),
            noToken:        address(noToken),
            totalLiquidity: 0,
            feeBps:         feeBps
        });
    }

function getMarketInfo() external view override returns (MarketInfo memory) {
    return _info;
}

function getPosition(address account) external view override returns (Position memory){
    return _positions[account];
}

function getPrice (OutcomeIndex outcome) public view override returns (uint256 price18){
    uint256 total = qYes + qNo;
    if (toatl == 0) returns PRECISION / 2; 
    if (outcome == OutcomeIndex.YES) return(qYes * PRECISION)/ total;
    if (outcome == OutcomeIndex.NO) return(qNo * PRECISION)/ total;
}

function getExpectedShares(OutcomeIndex outcome, uint256 collateralIn)
        external view override returns (uint256 shares)
    {
        uint256 netCollateral = _applyFee(collateralIn);
        shares = _collateralToShares(outcome, _toInternal(netCollateral));
    }

    function getExpectedCollateral(OutcomeIndex outcome, uint256 sharesIn)
        external view override returns (uint256 collateral)
    {
        uint256 rawCollateral = _sharesToCollateral(outcome, sharesIn);
        collateral = _fromInternal(rawCollateral);
    }

    function getLiquidity() external view override returns (uint256 yes, uint256 no, uint256 total) {
        yes   = qYes;
        no    = qNo;
        total = _info.totalLiquidity;
    }

    function buy (OutcomeIndex outcome, uint256 collateralIn, uint256 minSharesOut) external override nonReentrant returns (uint256 sharesOut)
    {
         if (_info.state != MarketState.OPEN)         revert MarketNotOpen();
        if (block.timestamp >= _info.closesAt)        revert MarketNotOpen();
        if (outcome != OutcomeIndex.YES && outcome != OutcomeIndex.NO) revert InvalidOutcome();
        if (collateralIn == 0)                        revert ZeroAmount();

        IERC20(_info.collateralToken).transferFrom(msg.sender, address(this), collateralIn);

        (uint256 protocolFee, uint256 lpFee, uint256 netCollateral) = _splitFees(collateralIn);
        _distributeFees(protocolFee, lpFee);

        uint256 internalCollateral = _toInternal(netCollateral);
        sharesOut = _collateralToShares(outcome, internalCollateral);
        if (sharesOut < minSharesOut) revert SlippageExceeded();

        if (outcome == OutcomeIndex.YES) qYes += sharesOut;
        else                             qNo  += sharesOut;

        _info.totalLiquidity += collateralIn;

        OutcomeToken token = (outcome == OutcomeIndex.YES) ? yesToken : noToken;
        token.mint(msg.sender, sharesOut);

        Position storage pos = _positions[msg.sender];
        if (outcome == OutcomeIndex.YES) {
            pos.yesShares += sharesOut;
        } else {
            pos.noShares  += sharesOut;
        }

        emit SharesBought(msg.sender, outcome, sharesOut, collateralIn);
    }

    function sell (OutcomeIndex outcome, uint shareIn, uint256 minCollaralOut) external override nonReentrant returns(uint256 collateralOut){
        
        if (_info.state != MarketState.OPEN)          revert MarketNotOpen();
        if (block.timestamp >= _info.closesAt)         revert MarketNotOpen();
        if (outcome != OutcomeIndex.YES && outcome != OutcomeIndex.NO) revert InvalidOutcome();
        if (sharesIn == 0)                             revert ZeroAmount();

        OutcomeToken token = (outcome == OutcomeIndex.YES) ? yesToken : noToken;
        token.burn(msg.sender, sharesIn);

        
        if (outcome == OutcomeIndex.YES) {
            if (qYes < sharesIn) revert InsufficientLiquidity();
            qYes -= sharesIn;
        } else {
            if (qNo < sharesIn)  revert InsufficientLiquidity();
            qNo  -= sharesIn;
        }

        uint256 rawOut = _sharesToCollateral(outcome, sharesIn);
        collateralOut  = _fromInternal(rawOut);

        (uint256 protocolFee, uint256 lpFee, uint256 net) = _splitFees(collateralOut);
        _distributeFees(protocolFee, lpFee);
        collateralOut = net;

        if (collateralOut < minCollateralOut) revert SlippageExceeded();

        _info.totalLiquidity = _info.totalLiquidity > collateralOut
            ? _info.totalLiquidity - collateralOut : 0;

        
        Position storage pos = _positions[msg.sender];
        if (outcome == OutcomeIndex.YES) pos.yesShares -= sharesIn;
        else                             pos.noShares  -= sharesIn;

        IERC20(_info.collateralToken).transfer(msg.sender, collateralOut);
        emit SharesSold(msg.sender, outcome, sharesIn, collateralOut);
    }

    function addLiquidity (uint256 collateralIn, uint256 minLpOut)
        external override nonReentrant returns (uint256 lpShares)
    {
        if (_info.state != MarketState.OPEN) revert MarketNotOpen();
        if (collateralIn == 0)               revert ZeroAmount();

        IERC20(_info.collateralToken).transferFrom(msg.sender, address(this), collateralIn);

        uint256 halfInternal = _toInternal(collateralIn) / 2;
        qYes += halfInternal;
        qNo  += halfInternal;

        lpShares = (totalLpShares == 0)
            ? collateralIn
            : (collateralIn * totalLpShares) / _info.totalLiquidity;

        if (lpShares < minLpOut) revert SlippageExceeded();

        totalLpShares       += lpShares;
        lpBalance[msg.sender] += lpShares;
        _info.totalLiquidity += collateralIn;
        _positions[msg.sender].lpShares += lpShares;

        emit LiquidityAdded(msg.sender, collateralIn, lpShares);
    }

function removeLiquidity(uint256 lpShares, uint256 minCollateralOut)
        external override nonReentrant returns (uint256 collateralOut)
    {
        if (lpBalance[msg.sender] < lpShares) revert InsufficientLiquidity();
        if (lpShares == 0)                    revert ZeroAmount();

        
        uint256 feesOwed = (pendingLpFees * lpShares) / totalLpShares;
        collateralOut = ((_info.totalLiquidity * lpShares) / totalLpShares) + feesOwed;

        if (collateralOut < minCollateralOut) revert SlippageExceeded();

        pendingLpFees              -= feesOwed;
        totalLpShares              -= lpShares;
        lpBalance[msg.sender]      -= lpShares;
        _info.totalLiquidity       -= (collateralOut - feesOwed);
        _positions[msg.sender].lpShares -= lpShares;

        IERC20(_info.collateralToken).transfer(msg.sender, collateralOut);
        emit LiquidityRemoved(msg.sender, lpShares, collateralOut);
    }

    function claimWinnings() external override nonReentrant returns (uint256 payout) {
        if (_info.state != MarketState.RESOLVED) revert MarketNotResolved();

        OutcomeToken winToken = (_info.resolution == OutcomeIndex.YES) ? yesToken : noToken;
        uint256 shares = winToken.balanceOf(msg.sender);
        if (shares == 0) return 0;

        // 1 share = 1 unit of collateral (normalised)
        payout = _fromInternal(shares);
        winToken.burn(msg.sender, shares);

        Position storage pos = _positions[msg.sender];
        if (_info.resolution == OutcomeIndex.YES) pos.yesShares = 0;
        else                                      pos.noShares  = 0;

        IERC20(_info.collateralToken).transfer(msg.sender, payout);
        emit WinningsClaimed(msg.sender, payout);
    }

    function cancel() external override nonReentrant {
        if (msg.sender != factory && msg.sender != resolver) revert Unauthorized();
        _info.state = MarketState.CANCELLED;
        // Refund logic handled by each holder individually via claimRefund()
    }

    
    function resolve(OutcomeIndex outcome) external {
        if (msg.sender != resolver) revert Unauthorized();
        if (_info.state == MarketState.RESOLVED) revert AlreadyResolved();
        if (outcome != OutcomeIndex.YES && outcome != OutcomeIndex.NO) revert InvalidOutcome();

        _info.state      = MarketState.RESOLVED;
        _info.resolution = outcome;

        
        OutcomeToken winToken = (outcome == OutcomeIndex.YES) ? yesToken : noToken;
        winToken.setTransferable(true);

        emit MarketResolved(outcome, msg.sender);
    }

    function setResolver(address _resolver) external {
        if (msg.sender != factory) revert Unauthorized();
        resolver = _resolver;
    }

    function _toInternal(uint256 amount) internal pure returns (uint256) {
        return amount * 1e12;
    }

    function _fromInternal(uint256 amount) internal pure returns (uint256) {
        return amount / 1e12; 
    }

    function _applyFee(uint256 amount) internal view returns (uint256) {
        return amount - (amount * _info.feeBps) / BPS;
    }

    function _splitFees(uint256 amount)
        internal view returns (uint256 protocolFee, uint256 lpFee, uint256 net)
    {
        uint256 totalFee = (amount * _info.feeBps) / BPS;
        protocolFee = totalFee / 2;
        lpFee       = totalFee - protocolFee;
        net         = amount - totalFee;
    }

    function _distributeFees(uint256 protocolFee, uint256 lpFee) internal {
        if (protocolFee > 0)
            IERC20(_info.collateralToken).transfer(treasury, protocolFee);
        pendingLpFees += lpFee;
    }

    function _collateralToShares(OutcomeIndex outcome, uint256 netCollateral18)
        internal view returns (uint256)
    {
        uint256 priceOfOutcome = getPrice(outcome);
        return (netCollateral18 * PRECISION) / priceOfOutcome;
    }

    function _sharesToCollateral(OutcomeIndex outcome, uint256 shares)
        internal view returns (uint256)
    {
        uint256 priceOfOutcome = getPrice(outcome);
        return (shares * priceOfOutcome) / PRECISION;
    }    
}