/**
 * @desc:
 * This visitor considers whether a require statement (and the variables it evaluates) should remain publicly visible in the smart contract, or whether the statement should be checked within a circuit, to preserve secrecy of variables.
 */
export default {
    FunctionCall: {
        enter(path, state) {
            const { node } = path;
            // here: we look for require statements and add new properties to the require node (a FunctionCall node).
            if (!path.isRequireStatement())
                return;
            // TODO: this very specific notion of 'requireStatementPrivate' is going to be generalised into ascribing properties to every node about whether it's secret / interacts with a secret / contains a secret.
            const visitor = (path, state) => {
                var _a;
                if ((_a = path.getReferencedBinding()) === null || _a === void 0 ? void 0 : _a.isSecret) {
                    state.requireStatementPrivate = true;
                    state.stopTraversal = true;
                }
            };
            const subState = { requireStatementPrivate: false };
            path.traversePathsFast(visitor, subState);
            // @Node new property
            node.requireStatementPrivate = subState.requireStatementPrivate;
        },
    },
};
