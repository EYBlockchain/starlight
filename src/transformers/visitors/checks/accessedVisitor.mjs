/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */
// no-unused-vars <-- to reinstate eventually
import logger from '../../../utils/logger.mjs';
import backtrace from '../../../error/backtrace.mjs';
import { TODOError, SyntaxUsageError } from '../../../error/errors.mjs';

/**
 * @desc:
 * Visitor checks whether a secret state is 'accessed'.
 * This means that we need to know the value (and open a commitment) to use it here.
 * An accessed state must be whole, because we can't open a dynamic number of commitments.
 */

export default {
  ExpressionStatement: {
    enter(path, state) {
      if (
        path.isIncremented &&
        path.scope.getReferencedBinding({
          nodeType: 'Identifier',
          referencedDeclaration: path.incrementedDeclaration,
        }).isPartitioned
      ) {
        state.inIncrementation = true;
        state.incrementedDeclaration = path.incrementedDeclaration;
      }
    },
    exit(path, state) {
      state.inIncrementation = false;
      state.incrementedDeclaration = null;
    },
  },

  Identifier: {
    enter(path, state) {
      // Here, if secret:
      // 1) Check if in a RHS container
      // 2) Check if NOT incrementing
      const { node, scope } = path;
      if (path.isMsg()) return; // the node represents the special 'msg' type in solidity
      if (path.isThis()) return; // the node represents the special 'this' type in solidity
      if (path.isExportedSymbol()) return; // the node represents an external contract name
      if (path.isRequireStatement()) return; // a require statement

      const referencedBinding = scope.getReferencedBinding(node);
      const rightAncestor = path.getRhsAncestor();
      const lhsNode = path.getCorrespondingLhsNode();
      // TODO getReferencedBinding should return the VariableDeclaration binding if the input is a VariableDeclaration
      const lhsBinding = lhsNode
        ? scope.getReferencedBinding(lhsNode) ||
          scope.getReferencedBinding({
            nodeType: 'Identifier',
            referencedDeclaration: lhsNode.id,
          })
        : null;

      // Check: is this a nonsecret param being used to edit a secret state?
      if (!referencedBinding?.isSecret) {
        if (
          rightAncestor &&
          lhsBinding?.isSecret &&
          !referencedBinding.stateVariable
        ) {
          logger.warn(
            `Non-secret parameter '${node.name}' used when assigning to a secret variable '${lhsBinding.name}'. Blockchain observers might be able to infer the value of '${lhsBinding.name}' from this. I.e. although you've labelled '${lhsBinding.name}' as 'secret', it might not be secret.`,
          );
          backtrace.getSourceCode(node.src);
        }
        return;
      }

      // Now we look for accessed states
      if (
        rightAncestor &&
        (!state.inIncrementation ||
          (state.inIncrementation &&
            node.referencedDeclaration !== state.incrementedDeclaration))
      ) {
        // BELOW - error checking
        // ------

        if (lhsNode === null)
          // null is bad
          throw new TODOError(
            `We couldn't find a node on the LHS of this RHS node. Please create an issue.`,
            node,
          );
        if (lhsNode !== false) {
          // false is ok - we have something without a LHS, like a++
          if (!referencedBinding.stateVariable) {
            // we have a secret parameter on the RHS
            if (!lhsBinding.isSecret)
              throw new SyntaxUsageError(
                `A secret parameter (${node.name}) should not be used to assign to a non-secret variable (${lhsNode.name}). The secret could be deduced by observing how the non-secret variable changes.`,
                node,
              );
            if (!lhsBinding.stateVariable)
              logger.warn(
                `Secret parameter ${node.name} is being used to assign a non-global state. Is this intended?`,
              );
            return; // we stop, because we never have to access parameters
          }
          if (!lhsBinding.isSecret) {
            // Henceforth `node` must be a stateVariable on the RHS
            throw new SyntaxUsageError(
              `Secret state ${node.name} should not be used to assign to a non-secret variable (${lhsNode.name}). The secret could be deduced by observing how the non-secret variable changes.`,
              node,
            );
          }
        }

        // ------
        logger.debug(`Found an accessed secret state ${node.name}`);
        scope.getReferencedBinding(node)?.updateAccessed(path);
        scope.getReferencedIndicator(node)?.updateAccessed(path);
        // @Node new property
        node.accessedSecretState = true;
        return;
      }
      // below: check if the identifier is on the LHS and is NOT partitioned AND requires the LHS value e.g. a *= b
      // we don't check all the types of LHS container, because a += b is always an Assignment with a .leftHandSide
      const leftAncestor = path.getAncestorContainedWithin('leftHandSide');

      if (
        leftAncestor &&
        !referencedBinding.isPartitioned &&
        ['*=', '+=', '-='].includes(leftAncestor.parent.operator)
      ) {
        logger.debug(
          `Found an accessed secret state ${node.name} (accessed in ${leftAncestor.parent.operator} operation)`,
        );
        scope.getReferencedBinding(node)?.updateAccessed(path);
        scope.getReferencedIndicator(node)?.updateAccessed(path);
      }
    },

    exit(path, state) {},
  },
};
