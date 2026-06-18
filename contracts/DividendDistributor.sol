// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SecurityToken.sol";

contract DividendDistributor is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    SecurityToken public securityToken;
    IERC20 public paymentToken;
    uint256 public totalDividendsPerShare;
    mapping(address => uint256) public userPaidPerShare;

    event DividendDistributed(uint256 amount, uint256 dividendsPerShare);
    event DividendClaimed(address indexed user, uint256 amount);

    constructor(address _securityToken, address _paymentToken) {
        securityToken = SecurityToken(_securityToken);
        paymentToken = IERC20(_paymentToken);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function distributeDividends(uint256 _amount) external onlyRole(ADMIN_ROLE) nonReentrant {
        require(_amount > 0, "DividendDistributor: Amount must be positive");
        paymentToken.transferFrom(msg.sender, address(this), _amount);
        uint256 supply = securityToken.totalSupply();
        if (supply > 0) totalDividendsPerShare += (_amount * 1e18) / supply;
        emit DividendDistributed(_amount, totalDividendsPerShare);
    }

    function claim() external nonReentrant {
        uint256 balance = securityToken.balanceOf(msg.sender);
        require(balance > 0, "DividendDistributor: No tokens held");
        uint256 owed = ((totalDividendsPerShare - userPaidPerShare[msg.sender]) * balance) / 1e18;
        userPaidPerShare[msg.sender] = totalDividendsPerShare;
        if (owed > 0) {
            paymentToken.transfer(msg.sender, owed);
            emit DividendClaimed(msg.sender, owed);
        }
    }
    function getPendingDividends(address _user) external view returns (uint256) {
        uint256 balance = securityToken.balanceOf(_user);
        return ((totalDividendsPerShare - userPaidPerShare[_user]) * balance) / 1e18;
    }
}