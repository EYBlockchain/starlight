// SPDX-License-Identifier: CC0

pragma solidity ^0.8.0;

contract BucketsOfBalls {

mapping(uint256 => uint256) public buckets;

function deposit(uint256 bucketId, uint amountDeposit) public {
buckets[bucketId] += amountDeposit;
}

function transfer(uint256 fromBucketId, uint256 numberOfBalls) public {
buckets[fromBucketId] -= numberOfBalls;
}
}
