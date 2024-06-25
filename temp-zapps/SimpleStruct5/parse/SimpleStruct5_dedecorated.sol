// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
uint256 private b;


struct MyStruct {
uint256 prop1;
bool prop2;
}

MyStruct public x;

function add( uint256 value, MyStruct memory struct_value, MyStruct memory struct_value_pub) public {
if(value > 10) {
x.prop1 += value;
x.prop2 = true;
a = value * x.prop1;
}
//secret MyStruct memory y;
//y.prop1=5;
//y.prop2 = true;
x.prop2 = struct_value.prop2 || x.prop2 || struct_value_pub.prop2;
x.prop1 += struct_value.prop1 + struct_value_pub.prop1;
}

}
