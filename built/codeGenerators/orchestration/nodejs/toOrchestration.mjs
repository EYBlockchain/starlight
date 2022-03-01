/* eslint-disable import/no-cycle, no-param-reassign, consistent-return */
import { OrchestrationCodeBoilerPlate } from '../../../boilerplate/orchestration/javascript/raw/toOrchestration.mjs';
import fileGenerator from '../files/toOrchestration.mjs';
/**
 * @desc:
 * Code generator for the output function e.g. myFunction.mjs
 * Creates the .mjs file which extracts commitment data and communicates with
 * Zokrates and Ethereum.
 */
/**
 * @param {string} name - variable name
 * @returns {string} - code line which will extract an accessed value from the user db
 */
const getAccessedValue = name => {
    return `\nlet { ${name} } = generalise(${name}_preimage);`;
};
/**
 * @param {Object} node - an orchestration AST node
 * @returns {Object} - { filepath: 'path/to/file.mjs', file: 'the code' };
 * The filepath will be used when saving the file into the new zApp's dir.
 */
function codeGenerator(node, options = {}) {
    // We do a special kind of traversal which outputs files and their contents
    // Separate files and folders are handled by fileGenerator
    // This codeGenerator deals with complex function code
    // We'll break things down by the `type` of the `node`.
    switch (node.nodeType) {
        case 'FunctionDefinition': {
            node.inputParameters = node.parameters.parameters.map(codeGenerator);
            node.returnParameters =
                node.returnParameters.parameters.map(codeGenerator) || [];
            const fn = OrchestrationCodeBoilerPlate(node);
            const statements = codeGenerator(node.body);
            fn.statements.push(statements);
            return `${fn.signature[0]}\n\t${fn.statements.join('')}\n${fn.signature[1]}`;
        }
        case 'ParameterList':
            return node.parameters.map(paramnode => paramnode.name);
        case 'VariableDeclaration': {
            return node.name;
        }
        case 'VariableDeclarationStatement': {
            if (!node.interactsWithSecret)
                return `\n// non-secret line would go here but has been filtered out`;
            if (node.initialValue.nodeType === 'Assignment') {
                if (node.declarations[0].isAccessed) {
                    return `${getAccessedValue(node.declarations[0].name)}\n${codeGenerator(node.initialValue)};`;
                }
                return `\nlet ${codeGenerator(node.initialValue)};`;
            }
            if (node.initialValue.operator &&
                !node.initialValue.operator.includes('='))
                return `\nlet ${node.declarations[0].name} = generalise(${codeGenerator(node.initialValue)});`;
            return `\nlet ${codeGenerator(node.initialValue)};`;
        }
        case 'ElementaryTypeName':
            return;
        case 'Block':
            return node.statements.map(codeGenerator).join(`\t`);
        case 'ExpressionStatement':
            if (!node.incrementsSecretState && node.interactsWithSecret)
                return `\n${codeGenerator(node.expression)};`;
            if (!node.interactsWithSecret)
                return `\n// non-secret line would go here but has been filtered out`;
            return `\n// increment would go here but has been filtered out`;
        case 'Assignment':
            if (['+=', '-=', '*='].includes(node.operator)) {
                return `${codeGenerator(node.leftHandSide, {
                    lhs: true,
                })} = ${codeGenerator(node.leftHandSide)} ${node.operator.charAt(0)} ${codeGenerator(node.rightHandSide)}`;
            }
            return `${codeGenerator(node.leftHandSide, { lhs: true })} ${node.operator} ${codeGenerator(node.rightHandSide)}`;
        case 'BinaryOperation':
            return `${codeGenerator(node.leftExpression)} ${node.operator} ${codeGenerator(node.rightExpression)}`;
        case 'MsgSender':
            // if we need to convert an owner's address to a zkp PK, it will not appear here
            // below is when we need to extract the eth address to use as a param
            return `msgSender.integer`;
        case 'TypeConversion':
            switch (node.type) {
                case 'address':
                    return `generalise(${codeGenerator(node.arguments)}).hex(20)`;
                default:
                    // TODO
                    return;
            }
        case 'Literal':
            return node.value;
        case 'Identifier':
            if (options === null || options === void 0 ? void 0 : options.lhs)
                return node.name;
            switch (node.subType) {
                default:
                case 'uint256':
                    return `parseInt(${node.name}.integer, 10)`;
                case 'address':
                    return `${node.name}.integer`;
            }
        case 'Folder':
        case 'File':
        case 'EditableCommitmentCommonFilesBoilerplate':
        case 'SetupCommonFilesBoilerplate':
        case 'IntegrationTestBoilerplate':
            // Separate files are handled by the fileGenerator
            return fileGenerator(node);
        case 'InitialisePreimage':
        case 'InitialiseKeys':
        case 'ReadPreimage':
        case 'WritePreimage':
        case 'MembershipWitness':
        case 'CalculateNullifier':
        case 'CalculateCommitment':
        case 'GenerateProof':
        case 'SendTransaction':
        case 'Imports':
        case 'KeyRegistrationFunction':
            return `${OrchestrationCodeBoilerPlate(node).statements.join('')}`;
        // And if we haven't recognized the node, we'll throw an error.
        default:
            throw new TypeError(node.nodeType);
    }
}
export { codeGenerator as default };
