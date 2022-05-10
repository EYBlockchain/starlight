/* eslint-disable import/no-cycle, no-nested-ternary */
import path from 'path';
import { collectImportFiles } from '../../common.js'
import CircuitBP from '../../../boilerplate/circuit/zokrates/raw/BoilerplateGenerator.js';
import NodePath from '../../../traverse/NodePath.js'
import {traversePathsFast} from '../../../traverse/traverse.js'
const Circuitbp = new CircuitBP();

function codeGenerator(node: any) {
  switch (node.nodeType) {
    case 'Folder':
      return CircuitBP.uniqueify(node.files.flatMap(codeGenerator));

    case 'File': {
      const filepath = path.join('./circuits', `${node.fileName}${node.fileExtension}`);
      const file = node.nodes.map(codeGenerator).join('\n\n');
      const thisFile = {
        filepath,
        file,
      };
      const importedFiles = collectImportFiles(file, 'circuit');
      return [thisFile, ...importedFiles];
    }

    case 'ImportStatementList':
      return `${CircuitBP.uniqueify(node.imports.flatMap(codeGenerator)).join('\n')}`;

    case 'FunctionDefinition': {
      let functionSignature : any;
      let returnType : any[] = [];
      const body = codeGenerator(node.body);
      let returnStatement : string[] = [];
      let returnName : string[] = [];
      if(node.returnParameters.parameters) {
        node.parameters.parameters.forEach(param => {
          if(param.bpType === 'newCommitment')
          returnName.push(param.name);
        });
      node.returnParameters.parameters.forEach( (node,index) => {

        if(node.name && node.isPrivate === true)
         returnStatement.push( `${returnName[index]}_newCommitment_commitment`);

        else if(node.name && node.isPrivate === false)
         returnStatement.push(`${node.name}`);
        else
        returnStatement.push(`${node.name}`);
        });
    }
    if(returnStatement.length > 0){
      returnStatement[0] = '('+returnStatement[0]
      returnStatement[returnStatement.length-1] = returnStatement[returnStatement.length-1]+')'
    }

    functionSignature  = `def main(\\\n\t${codeGenerator(node.parameters)}\\\n) -> `
    returnStatement.forEach( para => {
       if(para.includes('true') || para.includes('false')) {
         returnType.push('bool') ;
        } else {
           returnType.push('field') ;
        }
    })

      return `${functionSignature}(${returnType})

        ${body}

         return ${returnStatement}
        `;
    }

    case 'ParameterList': {
      const paramList = CircuitBP.uniqueify(node.parameters.flatMap(codeGenerator));

      // we also need to identify and remove duplicate params prefixed with conflicting 'public'/'private' keywords (prioritising 'public')
      const slicedParamList = paramList.map(p =>
        p.replace('public ', '').replace('private ', ''),
      );
      const linesToDelete = []; // we'll collect duplicate params here
      for (let i = 0; i < paramList.length; i++) {
        for (let j = i + 1; j < slicedParamList.length; j++) {
          if (slicedParamList[i] === slicedParamList[j]) {
            if (paramList[i].includes('private'))
              linesToDelete.push(paramList[i]);
            if (paramList[j].includes('private'))
              linesToDelete.push(paramList[j]);
          }
        }
      }
      for (let i = 0; i < linesToDelete.length; i++) {
        // remove duplicate params
        paramList.splice(paramList.indexOf(linesToDelete[i]), 1);
      }

      return paramList.join(',\\\n\t');
    }

    case 'VariableDeclaration': {
      const visibility =
        node.declarationType === 'parameter'
          ? node.isPrivate
            ? 'private '
            : 'public '
          : '\t\t';
      return `${visibility}${codeGenerator(node.typeName)} ${node.name}`;
    }

    case 'VariableDeclarationStatement': {
      const declarations = node.declarations.map(codeGenerator).join(', ');
      const initialValue = codeGenerator(node.initialValue);
      return `${declarations} = ${initialValue}`;
    }

    case 'ElementaryTypeName':
      return node.name;

    case 'Block': {
      const preStatements = CircuitBP.uniqueify(node.preStatements.flatMap(codeGenerator));
      const statements = CircuitBP.uniqueify(node.statements.flatMap(codeGenerator));
      const postStatements = CircuitBP.uniqueify(node.postStatements.flatMap(codeGenerator));
      return [...preStatements, ...statements, ...postStatements].join('\n\n');
    }

    case 'ExpressionStatement': {
      if (node.isVarDec) {
        return `
        field ${codeGenerator(node.expression)}`;
      }
      return codeGenerator(node.expression) ?? '';
    }
    case 'Return':
      return  ` ` ;

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide)} ${node.operator} ${codeGenerator(node.rightHandSide)}`;

    case 'BinaryOperation':
      return `${codeGenerator(node.leftExpression)} ${node.operator} ${codeGenerator(
        node.rightExpression,
      )}`;

    case 'Identifier':
      return node.name;

    case 'Literal':
      return node.value;

    case 'IndexAccess':
      return `${codeGenerator(node.baseExpression)}_${codeGenerator(node.indexExpression)}`;

    case 'TupleExpression':
      return `(${node.components.map(codeGenerator).join(` `)})`;

    case 'TypeConversion':
      return `${codeGenerator(node.arguments)}`;

    case 'MsgSender':
      return 'msg';

    case 'Assert':
      return `
        assert(${node.arguments.flatMap(codeGenerator)})`;

    case 'Boilerplate':
      return Circuitbp.generateBoilerplate(node);

    case 'BoilerplateStatement': {
      return Circuitbp.generateBoilerplate(node);
    }

    // And if we haven't recognized the node, we'll throw an error.
    default:
      if (!Object.keys(node).length) return ''; // we have empty nodes when subnodes are skipped
      throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
