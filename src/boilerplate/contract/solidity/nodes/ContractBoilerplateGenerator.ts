/** Keep a cache of previously-generated boilerplate, indexed by `indicator` objects (there is 1 indicator object per stateVar, per function). */
import Scope from '../../../../traverse/Scope.js';
import { VariableBinding } from '../../../../traverse/Binding.js';
import { StateVariableIndicator } from '../../../../traverse/Indicator.js';

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
    const bp: any[] = [];
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
        (b: any) => b.kind === 'FunctionDefinition' && b.name === '' && b.node.kind != 'fallback' && b.node.kind != 'receive', // this is the AST pattern for a constructor function
      );

      return [
        'importStatements',
        ...(containsCustomConstructorFunction ? [] : ['constructor']),
        'stateVariableDeclarations',
        'registerZKPPublicKey', // TODO: this is only needed if conversion between zkp PK's and Eth PK's is required.
        'verify',
        'joinCommitmentsFunction',
        'joinCommitmentsCircuitName',
        'splitCommitmentsFunction',
        'splitCommitmentsCircuitName',
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
      let isjoinSplitCommitmentsFunction : string[]=[];
      for(const [, binding ] of Object.entries(scope.bindings)){
       if((binding instanceof VariableBinding) && binding.isPartitioned && binding.isNullified && !binding.isStruct )
          isjoinSplitCommitmentsFunction?.push('true');
      }
      let {
        indicators: { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState, encryptionRequired },
      } = scope;
      const fnDefBindings = scope.filterBindings(
        (b: any) => b.kind === 'FunctionDefinition' && (b.path.containsSecret || b.path.scope.indicators.internalFunctionInteractsWithSecret),
      );
      let functionNames = Object.values(fnDefBindings).map((b: any) => b.path.getUniqueFunctionName());
      if (isjoinSplitCommitmentsFunction.includes('true')) { 
        functionNames.push('joinCommitments', 'splitCommitments');
        nullifiersRequired = true;
        oldCommitmentAccessRequired = true;
      }
      return {
        functionNames,
        nullifiersRequired,
        oldCommitmentAccessRequired,
        newCommitmentsRequired,
        containsAccessedOnlyState,
        encryptionRequired
      };
    },

    constructor() {
      const {indicators: { nullifiersRequired }} = this.scope;
      return { nullifiersRequired };
    },

    registerZKPPublicKey() {},

    verify(circuitParams: Object ) {
      let {
        indicators: { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState, encryptionRequired },
      } = this.scope;
      let isjoinSplitCommitmentsFunction : string[]=[];
      for(const [, binding ] of Object.entries(this.scope.bindings)){
       if((binding instanceof VariableBinding) && binding.isPartitioned && binding.isNullified && !binding.isStruct)
          isjoinSplitCommitmentsFunction?.push('true');
      }
      let parameterList: any[];
      let paramtype: string;
      let params : any[];
      let functionName: string;

      for ([functionName, parameterList] of Object.entries(circuitParams)) {
        for ([paramtype, params] of Object.entries(parameterList)){
        const returnpara = {};
        if(paramtype  === 'returnParameters'){
          returnpara[ paramtype ] = params;
          delete parameterList[ paramtype ];
        }
        const newList: string[] = [];
        
        params?.forEach(circuitParamNode => {
          switch (circuitParamNode.bpType) {
            case 'nullification':
              if (!newList.includes('nullifierRoot')) 
                  newList.push('nullifierRoot');
              if (circuitParamNode.isNullified) {
                if (!newList.includes('newNullifierRoot')) 
                  newList.push('newNullifierRoot');
                newList.push('nullifier');
 
              } 
              break;
            case 'newCommitment':
              newList.push(circuitParamNode.bpType);
              break;
            case 'oldCommitmentExistence':
              if (!newList.includes(circuitParamNode.bpType)) newList.push(circuitParamNode.bpType);
              break;
            case 'encryption':
              
              returnpara['encryptionParameters'] ??= [];
              returnpara['encryptionParameters'].push(circuitParamNode.bpType);
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
                } else if (circuitParamNode.typeName?.name.includes(`[`)) {
                  // TODO arrays of structs/structs of arrays/more robust soln
                  const arrayLen = circuitParamNode.typeName?.name.match(/(?<=\[)(\d+)(?=\])/);
                  for (let index = 0; index < +arrayLen[0]; index++) {
                    newList.push(`${circuitParamNode.name}[${index}]`);
                  }
                  break;
                } else newList.push(circuitParamNode.name);
              }
            }
            break;

            default:
              break;
          }
        });
        parameterList[ paramtype ] = newList;
        parameterList = {...parameterList, ...returnpara};    
      }
     circuitParams[ functionName ] = parameterList;
     
    }
      const constructorContainsSecret = Object.values(this.scope.bindings).some((binding: any) => binding.node.kind === 'constructor');
      return { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, containsAccessedOnlyState, encryptionRequired, constructorContainsSecret, circuitParams, isjoinSplitCommitmentsFunction};
    },

  };
}

export default ContractBoilerplateGenerator;
