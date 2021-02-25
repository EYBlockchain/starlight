// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.

/** Keep a cache of previously-generated boilerplate, indexed by `indicator` objects (there is 1 indicator object per stateVar, per function). */
const bpCache = new WeakMap();

class FunctionBoilerplateGenerator {
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
    const { scope } = this;
    const isConstructorFunction =
      scope.path.node.nodeType === 'FunctionDefinition' && scope.path.node.kind === 'constructor';
    if (isConstructorFunction) {
      return ['cnstrctr'];
    }

    return ['customFunction'];
  };

  generateNode = (bpCategory, bpSection, extraParams) => {
    return {
      nodeType: 'FunctionBoilerplate',
      bpSection,
      bpCategory,
      // inject bespoke data into the node, depending on the section / category:
      ...this[bpCategory][bpSection].bind(this)(extraParams),
    };
  };

  cnstrctr = {
    // all category objects will have a sectionSelector property (function)
    sectionSelector() {
      return ['parameters', 'postStatements'];
    },

    parameters() {},

    postStatements() {},
  };

  customFunction = {
    // all category objects will have a sectionSelector property (function)
    sectionSelector() {
      return ['parameters', 'postStatements'];
    },

    getIndicators() {
      const { indicators } = this.scope;

      let nullifiersRequired = false;
      let oldCommitmentAccessRequired = false;
      let newCommitmentRequired = false;

      for (const indicator of Object.values(indicators)) {
        if (indicator.isMapping) {
          for (const ind of Object.values(indicator.mappingKey)) {
            if (ind.isNullified) nullifiersRequired = true;
            if (ind.oldCommitmentAccessRequired) oldCommitmentAccessRequired = true;
            if (ind.newCommitmentRequired) newCommitmentRequired = true;
          }
        }
        if (indicator.isNullified) nullifiersRequired = true;
        if (indicator.oldCommitmentAccessRequired) oldCommitmentAccessRequired = true;
        if (indicator.newCommitmentRequired) newCommitmentRequired = true;
      }

      return { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentRequired };
    },

    parameters() {
      const indicators = this.customFunction.getIndicators.bind(this)();
      return { ...indicators };
    },

    postStatements() {
      const { scope } = this;
      const { path } = scope;
      // const { path } = scope;

      const params = path.getFunctionParameters();
      const publicParams = params?.filter(p => !p.isSecret).map(p => p.name);

      const functionName = path.node.name;

      const indicators = this.customFunction.getIndicators.bind(this)();

      return {
        ...(publicParams?.length && { customInputs: publicParams }),
        functionName,
        ...indicators,
      };
    },
  };
}

export default FunctionBoilerplateGenerator;
