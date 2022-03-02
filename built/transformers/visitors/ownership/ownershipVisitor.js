/* eslint-disable no-param-reassign, no-shadow, no-unused-vars */
import logger from '../../../utils/logger.js';
import { TODOError } from '../../../error/errors.js';
import { VariableBinding } from '../../../traverse/Binding.js';
/**
 * @desc:
 * Visitor asserts ownership of each secret state
 * If no errors, it updates the indicator with higher level info from the binding.
 * Finally, it checks, in the binding, that every secret whole state is nullified.
 */
export default {
    ContractDefinition: {
        exit(path) {
            var _a;
            for (const [, binding] of Object.entries(path.scope.bindings)) {
                if (!(binding instanceof VariableBinding))
                    continue;
                if (!binding.isSecret)
                    continue;
                binding.inferOwnership();
                if (binding.owner)
                    binding.ownerSetToZeroCheck();
                if (!binding.isOwned && binding.isWhole)
                    logger.warn(`Warning: secret state ${binding.name} is not owned. Without an owner, the state is initialised by the first caller submitting a dummy nullifier. This reveals when the state is initialised.`);
                if (!binding.isOwned && binding.isPartitioned)
                    logger.warn(`Warning: secret state ${binding.name} is not owned. Without an owner, the state is incremented by anyone and only the initialisers of those values may nullify them.`);
                if (binding.isOwned)
                    logger.debug(`The state ${binding.name} is owned by ${binding.owner.name}.`);
                if ((_a = binding.owner) === null || _a === void 0 ? void 0 : _a.mappingOwnershipType) {
                    logger.debug(`msg.sender owns the state when the mapping ${binding.owner.mappingOwnershipType} = msg.sender`);
                }
            }
        },
    },
    FunctionCall: {
        enter(path) {
            // Here: look for requirements on msg.sender
            const { node, scope } = path;
            if (!path.isRequireStatement())
                return;
            const requirement = node.arguments[0]; // only the 0th arg of a `require` statement contains logic; the other arg is a message.
            if (requirement.nodeType === 'BinaryOperation' &&
                (path.isMsgSender(requirement.leftExpression) ||
                    path.isMsgSender(requirement.rightExpression))) {
                // Here: either the lhs or rhs of require statement is msg.sender
                const functionDefScope = scope.getAncestorOfScopeType('FunctionDefinition');
                const { operator } = requirement;
                const msgComparisonNode = path.isMsgSender(requirement.leftExpression)
                    ? requirement.rightExpression
                    : requirement.leftExpression;
                const addressBinding = scope.getReferencedBinding(msgComparisonNode);
                if (!addressBinding)
                    throw new TODOError(`Requirements on msg.sender addresses are currently only supported as state variables. We will work on adding constant addresses and parameters.`, node);
                switch (operator) {
                    // We consider 'require(msg.sender == ...)' and 'require(msg.sender != ...)'
                    case '==':
                        // We'll infer from `require(msg.sender == ownerNode)` that the caller of this function is restricted to one "owner".
                        functionDefScope.addCallerRestriction('match', msgComparisonNode);
                        // @Node new property
                        node.requireStatementPrivate = !!(addressBinding === null || addressBinding === void 0 ? void 0 : addressBinding.isSecret);
                        break;
                    case '!=':
                        // We'll infer from `require(msg.sender != blacklistedAddress)` that the caller of this function is not allowed to be a particular blacklisted "blacklistedAddress".
                        functionDefScope.addCallerRestriction('exclude', msgComparisonNode);
                        // @Node new property
                        node.requireStatementPrivate = !!(addressBinding === null || addressBinding === void 0 ? void 0 : addressBinding.isSecret);
                        break;
                    default:
                        throw new TODOError(`This kind of restriction on msg.sender isn't implemented yet!`, node);
                }
            }
        },
    },
};
