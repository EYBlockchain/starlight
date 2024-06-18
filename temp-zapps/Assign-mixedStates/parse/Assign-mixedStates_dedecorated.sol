// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract Assign {

uint256 private a;
mapping(uint256 => uint256) public buckets;
function add(uint256 value, uint256 bucketId) public {
a += value;
buckets[bucketId] += value;
}

function remove(uint256 value, uint256 fromBucketId, uint256 toBucketId) public {

buckets[fromBucketId] -= value;
buckets[toBucketId] += value;

}
function remove1(uint256 value) public {
a -= value;
}
}
