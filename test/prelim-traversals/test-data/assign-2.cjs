module.exports = {
  contract: `
    pragma solidity ^0.8.0;

    contract MyContract {

        secret uint256 private a;

        function assign(secret uint256 param1) public {
            unknown a = param1;
        }
    }
  `,
  indicators: null,
  bindings: null,
  errorType: 'SomeError',
};
