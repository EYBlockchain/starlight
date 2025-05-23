/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */
import config from 'config';
import logger from '../../../utils/logger.js';
import backtrace from '../../../error/backtrace.js';
import { TODOError, SyntaxUsageError } from '../../../error/errors.js';
import NodePath from '../../../traverse/NodePath.js';
import { StateVariableIndicator } from '../../../traverse/Indicator.js';
/**
 * @desc:
 * Visitor checks whether a secret state is 'accessed'.
 * This means that we need to know the value (and open a commitment) to use it here.
 * An accessed state must be whole, because we can't open a dynamic number of commitments.
 */

export default {
  ExpressionStatement: {
    enter(path: NodePath, state: any) {
      if (
        path.isIncremented &&
        path.scope.getReferencedBinding({
          nodeType: 'Identifier',
          referencedDeclaration: path.incrementedDeclaration,
        })?.isPartitioned // if it's not partitioned, then its an overwrite, so we dont mark an incrementedDeclaration for this visitor
      ) {
        state.inIncrementation = true;
        state.incrementedDeclaration = path.incrementedDeclaration;
      }
    },
    // path is unused here but if unincluded we cannot acccess the state object
    exit(path: NodePath, state: any) {
      state.inIncrementation = false;
      state.incrementedDeclaration = null;
    },
  },

  Identifier: {
    enter(path: NodePath, state: any) {
      // Here, if secret:
      // 1) Check if in a 'RHS' container
      // 2) Check if NOT incrementing or WHOLE
      // e.g. a = 2b --> b accessed
      // e.g. a = a + b --> b accessed
      // e.g. a += 10, a whole --> a accessed
      // e.g. myMapping[a] = x --> a accessed
      const { node, scope} = path;
      if (path.isMsg()) return; // the node represents the special 'msg' type in solidity
      if (path.isThis()) return; // the node represents the special 'this' type in solidity
      if (path.isExportedSymbol()) return; // the node represents an external contract name
      if (path.isRequireStatement()) return; // a require statement
      if (path.isRevertStatement()) return;

      // setup - we get the left and right ancestors for error checking before anything else
      const referencedBinding = scope.getReferencedBinding(node);
      const rightAncestor = path.getRhsAncestor();
      const lhsNode = path.getCorrespondingLhsNode();
      // TODO getReferencedBinding should return the VariableDeclaration binding if the input is a VariableDeclaration
      const lhsBinding: any =
        ['Identifier', 'IndexAccess', 'MemberAccess'].includes(lhsNode?.nodeType )
          ? scope.getReferencedBinding(lhsNode) ||
            scope.getReferencedBinding({
              nodeType: 'Identifier',
              referencedDeclaration: lhsNode.id,
            })
          : scope.bindings[lhsNode?.id];
      // Check: is this a nonsecret param being used to edit a secret state?
      if (!referencedBinding?.isSecret) {
        // non-secret...
        if (
          rightAncestor &&
          lhsBinding?.isSecret &&
          referencedBinding?.path.isFunctionParameterDeclaration()
        ) {
          // ...param which is used to assign a secret state
          logger.warn(
            `Non-secret parameter '${node.name}' used when assigning to a secret variable '${lhsBinding.name}'. Blockchain observers might be able to infer the value of '${lhsBinding.name}' from this. I.e. although you've labelled '${lhsBinding.name}' as 'secret', it might not be secret.`,
          );
          logger.warn(`The secret variable '${lhsBinding.name}' is assigned a value derived from the non-secret parameter '${node.name}'. If '${node.name}' is modified in a concurrently issued transaction that is ordered before this one, it could invalidate the cryptographic proof backing the secret state change. This may result in the transaction failing, leading to wasted gas and proving effort.`);
          backtrace.getSourceCode(node.src);
        }
        // if its non-secret, no accessing occurs, we exit
        return;
      }

      // Now we look for accessed states

      // if this state is being referenced in a condition, it's accessed
      if (path.queryAncestors((parentPath: NodePath) => parentPath.containerName === 'condition') || path.queryAncestors((parentPath: NodePath) => parentPath.containerName === 'initializationExpression') || path.queryAncestors((parentPath: NodePath) => parentPath.containerName === 'loopExpression') ) {
        logger.debug(
          `Found an accessed secret state ${node.name} (accessed in a conditional operation)`,
        );
        scope.getReferencedBinding(node)?.updateAccessed(path);
        const indicator = scope.getReferencedIndicator(node);
        if (indicator instanceof StateVariableIndicator) indicator.updateAccessed(path);
        return;
      }
      // if this state is on the rhs AND isn't incremented OR is in an incrementation, but its not being incremented:
      if (
        rightAncestor &&
        (!state.inIncrementation ||
          (state.inIncrementation &&
            node.referencedDeclaration !== state.incrementedDeclaration))
      ) {
        // BELOW - error checking - extract?
        // ------

        if (lhsNode === null)
          // null is bad
          throw new TODOError(
            `We couldn't find a node on the LHS of this RHS node. Please create an issue.`,
            node,
          );
        if (lhsNode !== false && !path.isInType('FunctionCall')) {
          // false is ok - we have something without a LHS, like a conditional
          if (!referencedBinding.stateVariable) {
            // we have a secret parameter on the RHS
            if (!lhsBinding.isSecret && lhsBinding.stateVariable)
              // non-secret param assigning a secret state is ok, but we warn the user
              // however a secret param being used to assign a non-secret state is bad:
              throw new SyntaxUsageError(
                `A secret parameter (${node.name}) should not be used to assign to a non-secret variable (${lhsNode.name}). The secret could be deduced by observing how the non-secret variable changes.`,
                node,
              );
            if (!lhsBinding.stateVariable) {
              // we have secret param1 = param2 (e.g.) - this is weird
              logger.warn(
                `Secret parameter ${node.name} is being used to assign a non-global state. Is this intended?`,
              );
              backtrace.getSourceCode(node.src);
            }
            return; // we stop, because we never have to access parameters
          }
          if (!lhsBinding.isSecret) {
            // Henceforth `node` must be a stateVariable on the RHS
            throw new SyntaxUsageError(
              `Secret state ${node.name} should not be used to assign to a non-secret variable (${lhsNode.name}). The secret could be deduced by observing how the non-secret variable changes.`,
              node,
            );
          }
        } else if (rightAncestor instanceof NodePath && rightAncestor.parent.nodeType === 'IndexAccess') {
          // we still want to check params used as mapping keys here
          if (!referencedBinding.stateVariable) return;
          // TODO: consider errors for when we access a secret state to use it as a mappingKey
          // e.g. should we allow this for public mappings? (probably not)
        }
        // end of error checking
        // ------
        logger.debug(`Found an accessed secret state ${node.name}`);
        if (logger.level === 'debug') backtrace.getSourceCode(node.src);
        scope.getReferencedBinding(node)?.updateAccessed(path);
        const indicator = scope.getReferencedIndicator(node);
        if (indicator instanceof StateVariableIndicator) indicator.updateAccessed(path);
        // @Node new property
        node.accessedSecretState = true;
        return;
      }
      // below: check if the identifier is on the LHS and is NOT partitioned AND requires the LHS value e.g. a *= b
      // we don't check all the types of LHS container, because a +=,*=,-= b is always an Assignment with a .leftHandSide
      const leftAncestor = path.getAncestorContainedWithin('leftHandSide');

      if (
        leftAncestor &&
        !referencedBinding.isPartitioned && // if this is a partitioned incremented, it would have been marked already
        ['*=', '+=', '-='].includes(leftAncestor.parent.operator)
      ) {
        if (
          !referencedBinding.isWhole &&
          !referencedBinding.isKnown &&
          !referencedBinding.isUnknown
        ) {
          logger.warn(
            `We don't know whether this state ${node.name} is whole or partitioned - but since there are no known/unknown decorators, we assume its a whole state which nobody but the owner can edit.`,
          );
          referencedBinding.isWhole ??= true;
        }

        logger.debug(
          `Found an accessed secret state ${node.name} (accessed in ${leftAncestor.parent.operator} operation)`,
        );
        referencedBinding.updateAccessed(path);
        const indicator = scope.getReferencedIndicator(node);
        if (indicator instanceof StateVariableIndicator) indicator.updateAccessed(path);
      }
    },

    exit() {},
  },
};
