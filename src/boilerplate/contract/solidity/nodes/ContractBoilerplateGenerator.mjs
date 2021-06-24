/** Keep a cache of previously-generated boilerplate, indexed by `indicator` objects (there is 1 indicator object per stateVar, per function). */
const bpCache = new WeakMap();

class ContractBoilerplateGenerator {
  constructor(scope) {
    if (bpCache.has(scope)) return bpCache.get(scope);

    this.scope = scope;

    bpCache.set(scope, this);
  }

  getBoilerplate = section => {
    const bp = [];
    const categories = this.categorySelector();
    categories.forEach(category => {
      if (this[category].sectionSelector.bind(this)().includes(section)) {
        bp.push(this.generateNode(category, section));
      }
    });
    return bp;
  };

  categorySelector = () => {
    return ['contract'];
  };

  generateNode = (bpCategory, bpSection, extraParams) => {
    return {
      nodeType: 'ContractBoilerplate',
      bpSection,
      bpCategory,
      // inject bespoke data into the node, depending on the section / category:
      ...this[bpCategory][bpSection].bind(this)(extraParams),
    };
  };

  contract = {
    // all category objects will have a sectionSelector property (function)
    sectionSelector() {
      const { scope } = this;
      const containsCustomConstructorFunction = scope.someBinding(
        b => b.kind === 'FunctionDefinition' && b.name === '', // this is the AST pattern for a constructor function
      );

      return [
        'importStatements',
        ...(containsCustomConstructorFunction ? [] : ['constructor']),
        'stateVariableDeclarations',
        'registerZKPPublicKey', // TODO: this is only needed if conversion between zkp PK's and Eth PK's is required.
        'verify',
      ];
    },

    importStatements() {
      const {
        indicators: { newCommitmentsRequired },
      } = this.scope;
      return { newCommitmentsRequired };
    },

    stateVariableDeclarations() {
      const { scope } = this;
      const {
        indicators: { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired },
      } = scope;

      const fnDefBindings = scope.filterBindings(
        b => b.kind === 'FunctionDefinition' && b.name !== '',
      );
      const functionNames = Object.values(fnDefBindings).map(b => b.name);
      return {
        functionNames,
        nullifiersRequired,
        oldCommitmentAccessRequired,
        newCommitmentsRequired,
      };
    },

    constructor() {},

    registerZKPPublicKey() {},

    verify() {
      const {
        indicators: { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired },
      } = this.scope;
      return { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired };
    },
  };
}

export default ContractBoilerplateGenerator;
