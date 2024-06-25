// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Receipt {

mapping (uint256 => PO) private POs;
mapping (uint256 => Invoice) private invoices;

struct Invoice {
uint256 amount;
uint256 id;
}

struct PO {
uint256 count;
uint256 ppunit;
uint256 id;
address owner;
}

function addPO(PO memory newpo) public {
require(newpo.owner == msg.sender);
require(POs[newpo.id].id == 0); // inv shouldnt exist
POs[newpo.id] .count = newpo.count;
POs[newpo.id] .ppunit = newpo.ppunit;
POs[newpo.id] .id = newpo.id;
POs[newpo.id] .owner = newpo.owner;
}

function addInvoice(Invoice memory inv) public {
require(invoices[inv.id].id == 0); // inv shouldnt exist
invoices[inv.id] .amount = inv.amount;
invoices[inv.id] .id = inv.id;
require(POs[inv.id].count != 0);
require(inv.amount == POs[inv.id].count * POs[inv.id].ppunit);
}

function pay(uint256 id, uint256 amount) public {
// imagine a real payment here
require(invoices[id].amount == amount);
invoices[id].amount = 0;
require(POs[id].count != 0);
require(POs[id].owner == msg.sender);
}
}
