// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.
const bpCache = new WeakMap();
class FunctionBoilerplateGenerator {
    constructor(scope) {
        this.getBoilerplate = (section) => {
            const bp = [];
            const categories = this.categorySelector();
            categories.forEach(category => {
                if (this[category].sectionSelector.bind(this)().includes(section)) {
                    bp.push(this.generateNode(category, section));
                }
            });
            return bp;
        };
        this.categorySelector = () => {
            const { scope } = this;
            const isConstructorFunction = scope.path.node.nodeType === 'FunctionDefinition' && scope.path.node.kind === 'constructor';
            if (isConstructorFunction) {
                return ['cnstrctr'];
            }
            return ['customFunction'];
        };
        this.generateNode = (bpCategory, bpSection, extraParams) => {
            return Object.assign({ nodeType: 'FunctionBoilerplate', bpSection,
                bpCategory }, this[bpCategory][bpSection].bind(this)(extraParams));
        };
        this.cnstrctr = {
            // all category objects will have a sectionSelector property (function)
            sectionSelector() {
                return ['parameters', 'postStatements'];
            },
            parameters() { },
            postStatements() { },
        };
        this.customFunction = {
            // all category objects will have a sectionSelector property (function)
            sectionSelector() {
                return ['parameters', 'postStatements'];
            },
            getIndicators() {
                const { indicators } = this.scope;
                const { nullifiersRequired, oldCommitmentAccessRequired, msgSenderParam, containsAccessedOnlyState } = indicators;
                const newCommitmentsRequired = indicators.newCommitmentsRequired;
                return { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, msgSenderParam, containsAccessedOnlyState };
            },
            parameters() {
                const indicators = this.customFunction.getIndicators.bind(this)();
                return Object.assign({}, indicators);
            },
            // MIKE: you need to create a new msgSenderParam field of the Indicator class for the deposit function (by writing a new prelim traversal). Then using that indicator, you can pick up here.
            postStatements() {
                const { scope } = this;
                const { path } = scope;
                const params = path.getFunctionParameters();
                const publicParams = params === null || params === void 0 ? void 0 : params.filter((p) => !p.isSecret).map((p) => p.name);
                const functionName = path.node.name;
                const indicators = this.customFunction.getIndicators.bind(this)();
                // special check for msgSender param. If found, prepend a msgSender uint256 param to the contact's function.
                if (indicators.msgSenderParam)
                    publicParams.unshift('msgSender');
                return Object.assign(Object.assign(Object.assign({}, ((publicParams === null || publicParams === void 0 ? void 0 : publicParams.length) && { customInputs: publicParams })), { functionName }), indicators);
            },
        };
        if (bpCache.has(scope))
            return bpCache.get(scope);
        this.scope = scope;
        bpCache.set(scope, this);
    }
}
export default FunctionBoilerplateGenerator;
