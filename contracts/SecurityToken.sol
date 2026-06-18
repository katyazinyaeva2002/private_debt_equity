// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IIdentityRegistry {
    function isVerified(address _user) external view returns (bool);
}

contract SecurityToken is ERC20, AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    IIdentityRegistry public identityRegistry;
    mapping(address => uint256) public unlockTime;
    mapping(address => uint256) public frozenBalance;

    constructor(string memory name, string memory symbol, address _identityRegistry) ERC20(name, symbol) {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
    }

    modifier onlyVerified(address _sender, address _recipient) {
        require(identityRegistry.isVerified(_sender), "SecurityToken: Sender not verified");
        require(identityRegistry.isVerified(_recipient), "SecurityToken: Recipient not verified");
        _;
    }

    function transfer(address _to, uint256 _amount) public override whenNotPaused nonReentrant onlyVerified(msg.sender, _to) returns (bool) {
        require(block.timestamp >= unlockTime[msg.sender], "SecurityToken: Tokens are locked");
        require(_amount <= balanceOf(msg.sender) - frozenBalance[msg.sender], "SecurityToken: Insufficient unfrozen balance");
        return super.transfer(_to, _amount);
    }

    function mint(address _to, uint256 _amount) external onlyRole(ISSUER_ROLE) {
        require(identityRegistry.isVerified(_to), "SecurityToken: Recipient not verified");
        _mint(_to, _amount);
    }
    function burn(address _from, uint256 _amount) external onlyRole(ISSUER_ROLE) { _burn(_from, _amount); }
    function setUnlockTime(address _user, uint256 _timestamp) external onlyRole(ISSUER_ROLE) { unlockTime[_user] = _timestamp; }
    function freezeAddress(address _user, uint256 _amount) external onlyRole(COMPLIANCE_ROLE) { frozenBalance[_user] = _amount; }
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}