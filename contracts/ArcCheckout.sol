// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// arc-checkout: merchants create a charge (item + price), customers pay with USDC. A "Pay with USDC" button backend.
contract ArcCheckout {
    struct Charge { address merchant; string item; uint256 price; bool paid; address payer; uint256 createdAt; uint256 paidAt; }
    Charge[] public charges;
    mapping(address => uint256[]) private byMerchant;
    mapping(address => uint256) public merchantSales;
    uint256 public totalVolume;
    event ChargeCreated(uint256 indexed id, address indexed merchant, uint256 price);
    event ChargePaid(uint256 indexed id, address indexed payer, uint256 price);

    function createCharge(string calldata item, uint256 price) external returns (uint256 id) {
        require(price > 0, "Zero price");
        id = charges.length;
        charges.push(Charge(msg.sender, item, price, false, address(0), block.timestamp, 0));
        byMerchant[msg.sender].push(id);
        emit ChargeCreated(id, msg.sender, price);
    }
    function pay(uint256 id) external payable {
        Charge storage c = charges[id];
        require(!c.paid, "Already paid");
        require(msg.value == c.price, "Wrong amount");
        c.paid = true; c.payer = msg.sender; c.paidAt = block.timestamp;
        merchantSales[c.merchant] += msg.value; totalVolume += msg.value;
        (bool ok,) = payable(c.merchant).call{value: msg.value}(""); require(ok, "transfer failed");
        emit ChargePaid(id, msg.sender, msg.value);
    }
    function get(uint256 id) external view returns (Charge memory) { return charges[id]; }
    function getMerchant(address m) external view returns (uint256[] memory) { return byMerchant[m]; }
    function total() external view returns (uint256) { return charges.length; }
}
