// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PredictionMarket.sol";

coontract MarketFactory {
    
    address public owner;
    address public treasury;
    address public defaultResolver;

    uint256 public defaultFeeBps  = 200;   // 2 %
    uint256 public defaultLmsr_b  = 100e18; // Liquidity sensitivity

    mapping(address => bool) public approvedCollateral;

    bytes32[]                           public  allMarketIds;
    mapping(bytes32 => address)         public  markets;       // marketId → contract
    mapping(address => bool)            public  isMarket;
    mapping(address => bytes32[])       public  creatorMarkets; // creator → []marketId

    event MarketCreated(
        bytes32 indexed marketId,
        address indexed market,
        address indexed creator,
        address collateralToken,
        string  question,
        uint64  closesAt,
        uint64  resolvesAt
    );
    event CollateralApproved(address token, bool approved);
    event DefaultsUpdated(uint256 feeBps, uint256 lmsrB);
    event TreasuryUpdated(address treasury);
    event ResolverUpdated(address resolver);
    event OwnershipTransferred(address newOwner);


    error Unauthorized();
    error UnapprovedCollateral();
    error InvalidTimestamps();
    error MarketExists();
    error ZeroAddress();


    constructor(address _treasury, address _resolver) {
        owner           = msg.sender;
        treasury        = _treasury;
        defaultResolver = _resolver;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    function createMarket(
        string  calldata question,
        address          collateral,
        uint64           closesAt,
        uint64           resolvesAt,
        uint256          feeBps,
        uint256          lmsrB
    ) external returns (bytes32 marketId, address marketAddr) {
        if (!approvedCollateral[collateral]) revert UnapprovedCollateral();
        if (closesAt <= block.timestamp)     revert InvalidTimestamps();
        if (resolvesAt < closesAt)           revert InvalidTimestamps();

        if (feeBps  == 0) feeBps  = defaultFeeBps;
        if (lmsrB   == 0) lmsrB   = defaultLmsr_b;

        marketId = keccak256(abi.encodePacked(question, collateral, closesAt, msg.sender, block.number));
        if (markets[marketId] != address(0)) revert MarketExists();

        PredictionMarket pm = new PredictionMarket(
            marketId,
            question,
            closesAt,
            resolvesAt,
            collateral,
            feeBps,
            lmsrB,
            address(this),
            treasury,
            defaultResolver
        );

        marketAddr = address(pm);
        markets[marketId]  = marketAddr;
        isMarket[marketAddr] = true;
        allMarketIds.push(marketId);
        creatorMarkets[msg.sender].push(marketId);

        emit MarketCreated(
            marketId, marketAddr, msg.sender,
            collateral, question, closesAt, resolvesAt
        );
    }


    function totalMarkets() external view returns (uint256) { return allMarketIds.length; }

    function getMarkets(uint256 offset, uint256 limit)
        external view returns (bytes32[] memory ids, address[] memory addrs)
    {
        uint256 end = offset + limit > allMarketIds.length ? allMarketIds.length : offset + limit;
        uint256 len = end - offset;
        ids   = new bytes32[](len);
        addrs = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            ids[i]   = allMarketIds[offset + i];
            addrs[i] = markets[ids[i]];
        }
    }

    function getCreatorMarkets(address creator) external view returns (bytes32[] memory) {
        return creatorMarkets[creator];
    }


    function setCollateralApproval(address token, bool approved) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        approvedCollateral[token] = approved;
        emit CollateralApproved(token, approved);
    }

    function setDefaults(uint256 feeBps, uint256 lmsrB) external onlyOwner {
        defaultFeeBps = feeBps;
        defaultLmsr_b = lmsrB;
        emit DefaultsUpdated(feeBps, lmsrB);
    }

    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setResolver(address _resolver) external onlyOwner {
        if (_resolver == address(0)) revert ZeroAddress();
        defaultResolver = _resolver;
        emit ResolverUpdated(_resolver);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
        emit OwnershipTransferred(newOwner);
    }

    function overrideMarketResolver(bytes32 marketId, address newResolver) external onlyOwner {
        address marketAddr = markets[marketId];
        require(marketAddr != address(0), "Unknown market");
        PredictionMarket(marketAddr).setResolver(newResolver);
    }
}
