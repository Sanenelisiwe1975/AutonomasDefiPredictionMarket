// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PredictionMarket {
    string public question;
    uint256 public endTime;

    IERC20 public settlement;

    OutcomeToken public yesToken;
    OutcomeToken public noToken;

    address public resolver;

    bool public resolved;
    bool public outcome;

    uint256 public yesPool;
    uint256 public noPool;

    contructor (
        string memory question,
        uint256 _endtime,
        address _settlementToken,
        address _resolver,
    )
}