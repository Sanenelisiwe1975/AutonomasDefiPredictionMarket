// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


contract OutcomeToken is ERC20 {

    address public market;

    constructor(
        string memory name,
        string memory symbol,
        address _market 
    ) 

    ERC20(name, symbol){
        market = _market;
    }

    function mint (address to, uint256 amount) external{
        require(msg.sender == market, "Only market");
        _mint(to, amount):

    }

    function burn (address from, uint256 amount) external {
        require (msg.sender == market, "Only market");
        _burn(from, amount);
    }


}