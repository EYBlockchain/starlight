// SPDX-License-Identifier: CC0
pragma solidity ^0.8.0;
contract Assign {

uint256 private a;
uint256 private d;
uint256 private b;
uint256 public c;

function addB( uint256 value, uint256 value1) public {
c += value1;
a += value;
}
function addA( uint256 value) public {
d = a+ value;
}

function addC( uint256 value, uint256 value1) public {
c += value1;
d = a+ value;
}



function remove2( uint256 value, uint256 value1 ) public {
addC( value, value1);
addA(value1);
a += value;
b += value +a;
}

//function remove3( uint256 value, uint256 value1 ) public {
// addC( value, value1);
// a += value;
// addA(value1);
// known b += value +a;
//}

function remove4( uint256 value, uint256 value1 ) public {
addC( value, value1);
addA(value1);
}






}