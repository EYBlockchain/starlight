export default {
  correctZols: [
    {
      contract: `pragma solidity ^0.7.0;

      contract MyContract {

        secret uint256 private a;
        secret uint256 private b;

        function assign(uint256 param1, uint256 param2) public {
          known a = a + param1;
          b = param2;
        }
      }`,
      indicators: {
        a: {
          name: 'a',
          referenceCount: 2,
          modificationCount: 1,
          oldCommitmentReferenceRequired: true,
          isModified: true,
          isConsulted: true,
          newCommitmentRequired: true,
          nullifierRequired: true,
          initialisationRequired: true,
          isKnown: true,
          isIncremented: true,
          isDecremented: false,
          isWhole: true,
          isPartitioned: false, // false/undef,
          isWholeReason: [],
        },
        b: {
          name: 'b',
          referenceCount: 1,
          modificationCount: 1,
          oldCommitmentReferenceRequired: true,
          isModified: true,
          isConsulted: false,
          newCommitmentRequired: true,
          nullifierRequired: true,
          initialisationRequired: true,
          isKnown: true, // true/undef, (prefer true)
          isIncremented: false,
          isDecremented: false,
          isWhole: true,
          isPartitioned: false, // false/undef,
          isWholeReason: [],
        }
      }
    },
  ],

  errorZols: [
    {
      contract: `// SPDX-License-Identifier: CC0

      pragma solidity ^0.7.0;

      contract MyContract {

        secret uint256 private a;
        secret uint256 private b;

        function assign(secret uint256 param1, secret uint256 param2) public {
          unknown a = a + param1;
          b = a + param2;
        }
      }`,
      errorMessage: "Can't mark a whole state as unknown. The state a is whole due to: Consulted at 266:1:0",
    },
    {
      contract: `// SPDX-License-Identifier: CC0

      pragma solidity ^0.7.0;

      contract MyContract {

        secret uint256 private a;
        secret uint256 private b;

        function assign(uint256 param1, uint256 param2) public {
          unknown a = a + param1;
          known b = a + param2;
        }
      }`,
      errorMessage: "Can't mark a whole state as unknown. The state a is whole due to: Consulted at 264:1:0",
    },
    {
      contract: `// SPDX-License-Identifier: CC0

      pragma solidity ^0.7.0;

      contract MyContract {

        secret mapping(uint256 => uint256) private a;
        secret uint256 private b;

        function assign(uint256 param1, uint256 param2) public {
          unknown a[param1] = a[param1] + param2;
        }

        function assign2(uint256 param3, uint256 param4) public {
          a[param3] = a[param3] - param4;
        }

        function assign3(uint256 param5) public {
          b = param5;
        }
      }`,
      errorMessage: "Secret value assigned to, but known-ness unknown. Please let us know the known-ness by specifying known/unknown, and if you don't know, let us know.",
    }
  ]
};
