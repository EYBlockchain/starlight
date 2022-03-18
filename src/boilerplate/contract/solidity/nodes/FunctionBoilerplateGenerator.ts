// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.

/** Keep a cache of previously-generated boilerplate, indexed by `indicator` objects (there is 1 indicator object per stateVar, per function). */
import Scope from '../../../../traverse/Scope.js';

const bpCache = new WeakMap();

class FunctionBoilerplateGenerator {
  bpSections: string[] = ['importStatements', 'parameters', 'preStatements', 'postStatements'];
  scope: Scope;
  constructor(scope: Scope) {
    if (bpCache.has(scope)) return bpCache.get(scope);

    this.scope = scope;

    bpCache.set(scope, this);
  }

  getBoilerplate = (section: string) => {
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

  generateNode = (bpCategory: string, bpSection: string, extraParams?: any) => {
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

      const { nullifiersRequired, oldCommitmentAccessRequired, msgSenderParam, containsAccessedOnlyState } = indicators;
      const newCommitmentsRequired = indicators.newCommitmentsRequired;

      return { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, msgSenderParam, containsAccessedOnlyState };
    },

    parameters() {
      const indicators = this.customFunction.getIndicators.bind(this)();
      return { ...indicators };
    },

// MIKE: you need to create a new msgSenderParam field of the Indicator class for the deposit function (by writing a new prelim traversal). Then using that indicator, you can pick up here.
    postStatements() {
      const { scope } = this;
      const { path } = scope;

      const params = path.getFunctionParameters();
      const publicParams = params?.filter((p: any) => !p.isSecret).map((p: any) => p.name);

      const functionName = path.getUniqueFunctionName();

      const indicators = this.customFunction.getIndicators.bind(this)();

      // special check for msgSender param. If found, prepend a msgSender uint256 param to the contact's function.
      if (indicators.msgSenderParam) publicParams.unshift('msgSender');

      return {
        ...(publicParams?.length && { customInputs: publicParams }),
        functionName,
        ...indicators,
      };
    },
  };
}

export default FunctionBoilerplateGenerator;
