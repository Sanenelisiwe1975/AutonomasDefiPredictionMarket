// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


contract OutcomeToken is ERC20 {

    string public name:
    string public symbol;
    unit8 public constant decimals = 18;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balance;
    mapping(address => mapping(address=> uint256)) private _allowance;

    address public immutable market;
    bool public transferable;

    uint256 public snapshotId;
    mapping(uint256 => mapping(address => uint256)) private _snapshots;
    mapping(uint256 => uint256) private _snapshotTotals;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event TransferabilitySet(bool transferable);
    event Snapshot(uint256 id);

    error OnlyMarket();
    error NonTransferable();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();


    constructor(
        string memory name,
        string memory symbol,
        address _market 
    ) 

    modifier onlyMarket() {
        if (msg.sender != market) revert OnlyMarket();
        _;
    }

    
    function totalSupply() external view returns (uint256) { return _totalSupply; }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (!transferable && msg.sender != market) revert NonTransferable();
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (!transferable && msg.sender != market) revert NonTransferable();
        uint256 current = _allowances[from][msg.sender];
        if (current < amount) revert InsufficientAllowance();
        unchecked { _allowances[from][msg.sender] = current - amount; }
        _transfer(from, to, amount);
        return true;
    }
    
    function mint (address to, uint256 amount) external onlyMarket{
        if (to == address(0))revert ZeroAddress();
        -_totalSupply += amount;
        unchecked {_balance[to] += amount;}
        emit Transfer(address(0), to, amount);

    }

    function burn (address from, uint256 amount) external onlyMarket {
        uint256 bal = _balances[from];
        if (bal < amount) revert InsufficientBalance();
        unchecked {
            _balances[from] = bal - amount;
            _totalSupply   -= amount;
        }
        emit Transfer(from, address(0), amount);
    }

    function setTransferable(bool _transferable) external onlyMarket {
        transferable = _transferable;
        emit TransferabilitySet(_transferable);
    }

    function takeSnapshot() external onlyMarket returns (uint256 id) {

        id = ++snapshotId;
        -_snapshotTotals[id] = _totalSupply;
        emit Snapshot (id);
    }

    function balanceOfAt(address account, uint256 id) external view returns (uint256) {
        return _snapshots[id][account];
    }

    function totalSupplyAt(uint256 id) external view returns (uint256) {
        return _snapshotTotals[id];
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        uint256 bal = _balances[from];
        if (bal < amount) revert InsufficientBalance();
        unchecked {
            _balances[from] = bal - amount;
            _balances[to]  += amount;
        }
        
        if (snapshotId > 0) {
            _snapshots[snapshotId][from] = _balances[from];
            _snapshots[snapshotId][to]   = _balances[to];
        }
        emit Transfer(from, to, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        if (owner == address(0) || spender == address(0)) revert ZeroAddress();
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }


}