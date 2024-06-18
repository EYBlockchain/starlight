// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

bool private a;
bool private c;
bool public d;
bool public g;


function add( uint256 value, bool value_bool, bool value_publicbool) public {
bool l = true;
bool m = false;
c = a && m && d;
if(value > 10 && !c) {
c=true;
a= value_bool && value_publicbool;
}
if( value < 10) {
a =!c;
c= l || a || m;
}
}

}

