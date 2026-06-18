// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./SecurityToken.sol";

contract RedemptionManager is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    SecurityToken public securityToken;
    IERC20 public paymentToken;
    uint256 public maturityDate;
    bool public isCallable;
    bool public redemptionActive;
    uint256 public redemptionPrice;

    event RedemptionTriggered(uint256 timestamp);
    event TokenRedeemed(address indexed user, uint256 amount, uint256 payout);

    constructor(address _securityToken, address _paymentToken, uint256 _maturityDate, uint256 _redemptionPrice) {
        securityToken = SecurityToken(_securityToken);
        paymentToken = IERC20(_paymentToken);
        maturityDate = _maturityDate;
        redemptionPrice = _redemptionPrice;
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    function triggerCall() external onlyRole(ADMIN_ROLE) {
        require(isCallable, "RedemptionManager: Not callable");
        redemptionActive = true;
        emit RedemptionTriggered(block.timestamp);
    }

    function redeem(uint256 _amount) external nonReentrant {
        require(redemptionActive || block.timestamp >= maturityDate, "RedemptionManager: Redemption not active");
        require(securityToken.balanceOf(msg.sender) >= _amount, "RedemptionManager: Insufficient balance");
    
        // 1. Переводим токены от инвестора на адрес этого контракта
        securityToken.transferFrom(msg.sender, address(this), _amount);
    
        // 2. Сжигаем токены, которые теперь лежат на адресе контракта
        securityToken.burn(address(this), _amount); 
    
        // 3. Рассчитываем и выплачиваем сумму
        uint256 payout = (_amount * redemptionPrice) / 1e18;
        require(paymentToken.balanceOf(address(this)) >= payout, "RedemptionManager: Insufficient funds (DEFAULT)");
        paymentToken.transfer(msg.sender, payout);
        emit TokenRedeemed(msg.sender, _amount, payout);
    }  

    function getRedemptionStatus() external view returns (bool) {
        return redemptionActive || block.timestamp >= maturityDate;
    }
}