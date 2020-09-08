pragma solidity <0.6.0;

import "./SafeMath.sol";
import "./IERC20.sol";

contract Escrow {
    using SafeMath for uint256;

    address owner;
    secret mapping (address => uint256) balances;

    IERC20 public erc20;

    event Transfer(address indexed from, address indexed to, uint256 amount);

    constructor(address _erc20) public {
        owner = msg.sender;
        erc20 = IERC20(_erc20);
    }

    modifier onlyOwner () {
        require(msg.sender == owner);
        _;
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    function deposit (
        uint256 amount
    ) external {
        bool success = erc20.transferFrom(msg.sender, address(this), amount);

        require(success, "Transfer request rejected");

        balances[msg.sender] = balances[msg.sender].add(amount);
    }

    function transfer(
        secret address recipient,
        secret uint256 amount
    ) secret external {
        balances[msg.sender] = balances[msg.sender].sub(amount, "ERC20: transfer amount exceeds balance");

        balances[recipient] = balances[recipient].add(amount);

        emit Transfer(msg.sender, recipient, amount);
    }

    function withdraw (
        uint256 amount
    ) external {
        balances[msg.sender] = balances[msg.sender].sub(amount, "ERC20: burn amount exceeds balance");

        bool success = erc20.transfer(msg.sender, amount);
        require(success, "Transfer request rejected");
    }
}
