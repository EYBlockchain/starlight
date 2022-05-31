/** Keep a cache of previously-generated boilerplate, indexed by `indicator` objects (there is 1 indicator object per stateVar, per function). */
import Scope from '../../../../traverse/Scope.js';

const bpCache = new WeakMap();

class ContractBoilerplateGenerator {
  bpSections: string[] = ['importStatements', 'parameters', 'preStatements', 'postStatements'];
  scope : Scope;
  constructor(scope: Scope) {
    if (bpCache.has(scope)) return bpCache.get(scope);

    this.scope = scope;

    bpCache.set(scope, this);
  }

  getBoilerplate = (section: string, extraParams?: any) => {
    const bp = [];
    const categories: string[] = this.categorySelector();
    categories.forEach(category => {
      if (this[category].sectionSelector.bind(this)().includes(section)) {
        bp.push(this.generateNode(category, section, extraParams));
      }
    });
    return bp;
  };

  categorySelector = () => {
    return ['contract'];
  };

  generateNode = (bpCategory: string, bpSection: string, extraParams?: any) => {
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
        (b: any) => b.kind === 'FunctionDefinition' && b.name === '', // this is the AST pattern for a constructor function
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
        indicators: { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState },
      } = scope;

      const fnDefBindings = scope.filterBindings(
        (b: any) => b.kind === 'FunctionDefinition' && b.path.containsSecret,
      );
      const functionNames = Object.values(fnDefBindings).map((b: any) => b.path.getUniqueFunctionName());

      return {
        functionNames,
        nullifiersRequired,
        oldCommitmentAccessRequired,
        newCommitmentsRequired,
        containsAccessedOnlyState
      };
    },

    constructor() {},

    registerZKPPublicKey() {},

    verify(circuitParams: Object) {
      const {
        indicators: { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState },
      } = this.scope;


      const parameters = {};
      let parameterList: any[];
      let functionName: string;

      for ([functionName, parameterList] of Object.entries(circuitParams)) {
        const newList = [];
        parameterList.forEach(circuitParamNode => {
          switch (circuitParamNode.bpType) {
            case 'nullification':
              if (circuitParamNode.isNullified) {
                newList.push('nullifier');
              } else {
                // we use a nullification node for accessed, not nullified, states
                newList.push('checkNullifier')
              }
              break;
            case 'newCommitment':
              newList.push(circuitParamNode.bpType);
              break;
            case 'oldCommitmentExistence':
              if (!newList.includes(circuitParamNode.bpType)) newList.push(circuitParamNode.bpType);
              break;
            case undefined: {
              if (
                circuitParamNode.nodeType === 'VariableDeclaration' &&
                !circuitParamNode.isPrivate &&
                !newList.some(str => str === circuitParamNode.name)
              ){
                if (circuitParamNode.typeName?.members) {
                  newList.push(...circuitParamNode.typeName.members.map(m => `${circuitParamNode.name}.${m.name}`));
                  break;
                } else newList.push(circuitParamNode.name);
              }
            }
            default:
              break;
          }
        });
        parameters[functionName] = newList;
      }
      const constructorContainsSecret = Object.values(this.scope.bindings).some((binding: any) => binding.node.kind === 'constructor')
      return { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState, constructorContainsSecret, parameters };
    },

  };
}

export default ContractBoilerplateGenerator;
