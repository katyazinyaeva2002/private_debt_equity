// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SecurityToken.sol";
import "./IdentityRegistry.sol";

contract FundraisingContract is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    SecurityToken public securityToken;
    IERC20 public paymentToken;
    IdentityRegistry public identityRegistry;
    uint256 public hardCap;
    uint256 public tokenPrice;
    uint256 public totalRaised;
    bool public fundraisingActive;

    event ContributionReceived(address indexed investor, uint256 amount, uint256 tokensMinted);

    constructor(address _securityToken, address _paymentToken, address _identityRegistry, uint256 _hardCap, uint256 _tokenPrice) {
        securityToken = SecurityToken(_securityToken);
        paymentToken = IERC20(_paymentToken);
        identityRegistry = IdentityRegistry(_identityRegistry);
        hardCap = _hardCap; tokenPrice = _tokenPrice;
        _grantRole(ADMIN_ROLE, msg.sender);
        fundraisingActive = true;
    }

    function contribute(uint256 _amount) external nonReentrant {
        require(fundraisingActive, "Fundraising: Not active");
        require(identityRegistry.isVerified(msg.sender), "Fundraising: Not verified");
        require(totalRaised + _amount <= hardCap, "Fundraising: Hard cap exceeded");
        paymentToken.transferFrom(msg.sender, address(this), _amount);
        uint256 tokens = _amount / tokenPrice;
        require(tokens > 0, "Fundraising: Amount too low");
        securityToken.mint(msg.sender, tokens);
        totalRaised += _amount;
        emit ContributionReceived(msg.sender, _amount, tokens);
    }
    function finalize() external onlyRole(ADMIN_ROLE) { fundraisingActive = false; }
}