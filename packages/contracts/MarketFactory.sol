// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PredictionMarket.sol";

contract MarketFactory {

    address public settlementToken;
    address[] public markets;

    event MarketCreated(address market, string question);

    constructor(address _settlementToken) {
        settlementToken = _settlementToken;
    }

    function createMarket(
        string memory question,
        uint256 endTime,
        address resolver
    ) external returns (address) {

        PredictionMarket market = new PredictionMarket(
            question,
            endTime,
            settlementToken,
            resolver
        );

        markets.push(address(market));

        emit MarketCreated(address(market), question);

        return address(market);
    }

    function getMarkets() external view returns(address[] memory) {
        return markets;
    }
}