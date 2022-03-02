const bpCache = new WeakMap();
class ContractBoilerplateGenerator {
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
            return ['contract'];
        };
        this.generateNode = (bpCategory, bpSection, extraParams) => {
            return Object.assign({ nodeType: 'ContractBoilerplate', bpSection,
                bpCategory }, this[bpCategory][bpSection].bind(this)(extraParams));
        };
        this.contract = {
            // all category objects will have a sectionSelector property (function)
            sectionSelector() {
                const { scope } = this;
                const containsCustomConstructorFunction = scope.someBinding((b) => b.kind === 'FunctionDefinition' && b.name === '');
                return [
                    'importStatements',
                    ...(containsCustomConstructorFunction ? [] : ['constructor']),
                    'stateVariableDeclarations',
                    'registerZKPPublicKey',
                    'verify',
                ];
            },
            importStatements() {
                const { indicators: { newCommitmentsRequired }, } = this.scope;
                return { newCommitmentsRequired };
            },
            stateVariableDeclarations() {
                const { scope } = this;
                const { indicators: { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState }, } = scope;
                const fnDefBindings = scope.filterBindings((b) => b.kind === 'FunctionDefinition' && b.name !== '');
                const functionNames = Object.values(fnDefBindings).map((b) => b.name);
                return {
                    functionNames,
                    nullifiersRequired,
                    oldCommitmentAccessRequired,
                    newCommitmentsRequired,
                    containsAccessedOnlyState
                };
            },
            constructor() { },
            registerZKPPublicKey() { },
            verify() {
                const { indicators: { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState }, } = this.scope;
                return { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState };
            },
        };
        if (bpCache.has(scope))
            return bpCache.get(scope);
        this.scope = scope;
        bpCache.set(scope, this);
    }
}
export default ContractBoilerplateGenerator;
