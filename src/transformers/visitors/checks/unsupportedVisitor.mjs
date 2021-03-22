/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */

/**
 * @desc:
 * Visitor will throw errors when certain nodeTypes are traversed.
 * Namely: nodeTypes for complex Solidity syntax which we haven't written
 * support for yet.
*/

import cloneDeep from 'lodash.clonedeep';

export default {
  PragmaDirective: {
    // TODO: We should probably check that the `.zol` Pragma is 'supported'. The output Solidity's pragma will be limited to the latest-supported boilerplate code.
    // However, for now, we'll just inherit the Pragma of the original and hope.
    enter(path, state) {},
    exit(path, state) {},
  },

  StructuredDocumentation: {
    enter(path, state) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state) {},
  },

  InlineAssembly: {
    enter(path, state) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state) {},
  },

  EnumDefinition: {
    // TODO we can work on this later
    enter(path, state) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state) {},
  },

  StructDefinition: {
    enter(path, state) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state) {},
  },

  WhileStatement: {
    enter(path, state) {
      throw new Error('Unsupported Solidity');
    },

    exit(path, state) {},
  },
};
