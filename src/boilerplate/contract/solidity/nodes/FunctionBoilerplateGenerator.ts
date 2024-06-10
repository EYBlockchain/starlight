// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.

/** Keep a cache of previously-generated boilerplate, indexed by `indicator` objects (there is 1 indicator object per stateVar, per function). */
import Scope from '../../../../traverse/Scope.js';
import NodePath from '../../../../traverse/NodePath.js';

const bpCache = new WeakMap();

class FunctionBoilerplateGenerator {
  bpSections: string[] = ['importStatements', 'parameters', 'preStatements', 'postStatements'];
  scope: Scope;
  constructor(scope: Scope) {
    if (bpCache.has(scope)) return bpCache.get(scope);

    this.scope = scope;

    bpCache.set(scope, this);
  }

  getBoilerplate = (section: string, extraParams?: any) => {
    const bp: any[] = [];
    const categories = this.categorySelector();
    categories.forEach(category => {
      if (this[category].sectionSelector.bind(this)().includes(section)) {
        bp.push(this.generateNode(category, section, extraParams));
      }
    });
    return bp;
  };

  categorySelector = () => {
    const { scope } = this;

    const isConstructorFunction =
      scope.path.node.nodeType === 'FunctionDefinition' && scope.path.node.kind === 'constructor';
    if (isConstructorFunction && scope.containsSecret) {
      return ['cnstrctr', 'customFunction'];
    } else if (isConstructorFunction) {
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
      return ['parameters', 'preStatements'];
    },

    parameters() {},

    preStatements() {},
  };

  customFunction = {
    // all category objects will have a sectionSelector property (function)
    sectionSelector() {
      return ['parameters', 'postStatements'];
    },

    getIndicators() {
      const { indicators, msgSigRequired } = this.scope;
      const isConstructor = this.scope.path.node.kind === 'constructor' ? true : false;

      const { nullifiersRequired, oldCommitmentAccessRequired, msgSenderParam, msgValueParam, containsAccessedOnlyState, encryptionRequired } = indicators;
      const newCommitmentsRequired = indicators.newCommitmentsRequired;
      return { nullifiersRequired, oldCommitmentAccessRequired, newCommitmentsRequired, msgSenderParam, msgValueParam, containsAccessedOnlyState, isConstructor, encryptionRequired };
    },

    parameters() {
      const indicators = this.customFunction.getIndicators.bind(this)();
      return { ...indicators };
    },

// MIKE: you need to create a new msgSenderParam field of the Indicator class for the deposit function (by writing a new prelim traversal). Then using that indicator, you can pick up here.
    postStatements(customInputs: any[] = []) {
      const { scope } = this;
      const { path } = scope;
    

      const customInputsMap = (node: any) => {
        if (path.isStruct(node)) {
          const structDef = path.getStructDeclaration(node);
          const names = structDef.members.map((mem: any) => {
            return { name: `${node.name}.${mem.name}`, type: mem.typeName.name || mem.typeName.baseType.name, isConstantArray: path.isConstantArray(mem) ? mem.typeName.length.value : false, inCircuit: node.interactsWithSecret };
          });
          return { structName: structDef.name, properties: names, isParam: path.isFunctionParameter(node), isConstantArray: path.isConstantArray(node) ? node.typeName.length.value : false, inCircuit: node.interactsWithSecret };
        }
        return { name: node.name, type: node.typeName.name || node.typeName.baseType?.name || node.typeName.pathNode?.name, isParam: path.isFunctionParameter(node), isConstantArray: path.isConstantArray(node) ? node.typeName.length.value : false, inCircuit: node.interactsWithSecret };
      }

      const params = path.getFunctionParameters();
      
      const publicParams = params?.filter((p: any) => !p.isSecret).map((p: any) => customInputsMap(p)).concat(customInputs);
      const functionName = path.getUniqueFunctionName();
      const indicators = this.customFunction.getIndicators.bind(this)();

  

      // special check for msgSender and msgValue param. If msgsender is found, prepend a msgSender uint256 param to the contact's function.
      if (indicators.msgSenderParam) publicParams.unshift({ name: 'msg.sender', type:'address' , dummy: true, inCircuit: true});
      if (indicators.msgValueParam) publicParams.unshift({ name: 'msg.value', type:'uint256' , dummy: true,  inCircuit: true});
      let internalFunctionEncryptionRequired = false;


      path.node._newASTPointer.body.statements?.forEach((node) => {
        if(node.expression?.nodeType === 'InternalFunctionCall'){
          if(node.expression.encryptionRequired) 
           internalFunctionEncryptionRequired = true; 

        }
        
      })


      if(path.node.returnParameters.parameters.length === 0 && !indicators.encryptionRequired && !internalFunctionEncryptionRequired){
        publicParams?.push({ name: 1, type: 'uint256', dummy: true , inCircuit: true });
      }
      return {
        ...(publicParams?.length && { customInputs: publicParams }),
        functionName,
        ...indicators,
      };
    },
  };



}

export default FunctionBoilerplateGenerator;
