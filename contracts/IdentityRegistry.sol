// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/access/AccessControl.sol";

contract IdentityRegistry is AccessControl {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    mapping(address => bool) public isVerified;
    mapping(address => uint8) public investorType;
    mapping(address => string) public jurisdiction;

    event IdentityVerified(address indexed user, uint8 investorType);
    event IdentityRevoked(address indexed user);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(COMPLIANCE_ROLE, msg.sender);
    }

    function setVerificationStatus(
        address _user, bool _status, uint8 _investorType, string memory _jurisdiction
    ) external onlyRole(COMPLIANCE_ROLE) {
        isVerified[_user] = _status;
        investorType[_user] = _status ? _investorType : 0;
        jurisdiction[_user] = _status ? _jurisdiction : "";
        if (_status) emit IdentityVerified(_user, _investorType);
        else emit IdentityRevoked(_user);
    }
}