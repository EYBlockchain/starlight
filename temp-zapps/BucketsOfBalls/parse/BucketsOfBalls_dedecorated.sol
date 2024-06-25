// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract BucketsOfBalls {

mapping(uint256 => uint256) public buckets;

function deposit(uint256 bucketId, uint256 amountDeposit) public {
buckets[bucketId] += amountDeposit;
}

function transfer(uint256 fromBucketId, uint256 numberOfBalls) public returns ( bool, uint256) {
buckets[fromBucketId] -= numberOfBalls;
return (true, buckets[fromBucketId]);
}
}
