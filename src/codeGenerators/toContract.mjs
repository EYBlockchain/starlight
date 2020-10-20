/* eslint-disable prettier/prettier */
import cloneDeep from 'lodash.clonedeep';

const ShieldContractStatementsBoilerplate = stage => {
  const dummyId = -1; // We'll have to think about this
  switch (stage) {
    case 'SourceUnit':
      return {
        "absolutePath": "input",
        "exportedSymbols": {
            "AssignShield": [
                ''
            ]
        },
        "id": '',
        "license": "CC0",
        "nodeType": "SourceUnit",
        "nodes": [],
        "src": ''
      };
    case 'PragmaDirective':
      return {
        "id": 1,
        "literals": [
            "solidity",
            "^",
            "0.7",
            ".0"
        ],
        "nodeType": "PragmaDirective",
        "src": ''
      };
    case 'ContractDefinition':
      // TODO - make sure 'Contract is MerkleTree'
      return {
        "abstract": false,
        "baseContracts": [],
        "contractDependencies": [],
        "contractKind": "contract",
        "fullyImplemented": true,
        "id": dummyId,
        "linearizedBaseContracts": [
            dummyId
        ],
        "name": "AssignShield",
        "nodeType": "ContractDefinition",
        "nodes": [], // we push to this
        "scope": dummyId, // This would be the id of the SourceUnit
        "src": '' // line no.
      };
    case 'Globals':
      // TODO - verifier of type Verifier_Interface
      const mappings = [];
      mappings.push(ShieldContractMappingBoilerplate('nullifiers', 'uint256'));
      mappings.push(ShieldContractMappingBoilerplate('commitmentRoots', 'uint256'));
      mappings.push(ShieldContractMappingBoilerplate('vk', 'uint256', 'uint256[]'));
      return mappings;
    case 'Constructor':
      return ShieldContractConstructorBoilerplate();
    case 'Main':
      // TODO have proper function calls for verify() and insertLeaf() (atm they are dummy fns)
      return ShieldContractMainBoilerplate();
    default:
      return;
  }

};


const ShieldContractImportsBoilerplate = [
  'import "./merkle-tree/MerkleTree.sol";',
  'import "./verify/Verifier_Interface.sol";',
];

const ShieldContractMappingBoilerplate = (name, type1, type2 = type1) => {
  const obj = {
    "constant": false,
    "functionSelector": "d21e82ab",
    "id": '',
    "mutability": "mutable",
    "name": `${name}`,
    "nodeType": "VariableDeclaration",
    "scope": '', // id of ContractDefinition
    "src": '',
    "stateVariable": true,
    "storageLocation": "default",
    "typeDescriptions": {
        "typeIdentifier": `t_mapping$_t_${type1}_$_t_u${type2}_$`,
        "typeString": `mapping(${type1} => ${type2})`
    },
    "typeName": {
        "id": '',
        "keyType": {
            "id": '',
            "name": `${type1}`,
            "nodeType": "ElementaryTypeName",
            "src": '',
            "typeDescriptions": {
                "typeIdentifier": `t_${type1}`,
                "typeString": `${type1}`
            }
        },
        "nodeType": "Mapping",
        "src": '',
        "typeDescriptions": {
            "typeIdentifier": `t_mapping$_t_${type1}_$_t_u${type2}_$`,
            "typeString": `mapping(${type1} => ${type2})`
        },
        "valueType": {
            "id": '',
            "name": `${type2}`,
            "nodeType": "ElementaryTypeName",
            "src": '',
            "typeDescriptions": {
                "typeIdentifier": `t_${type2}`,
                "typeString": `${type2}`
            }
        }
    },
    "visibility": "public"
  };
  if (type2.includes('[]')) {
    // bodge
    obj.typeName.valueType.baseType = cloneDeep(obj.typeName.valueType);
    obj.typeName.valueType.nodeType = "ArrayTypeName";
    obj.typeName.valueType.typeDescriptions = {
      "typeIdentifier": `t_array$_t_${type2}_$dyn_storage_ptr`,
      "typeString": `${type2}[]`
    };
  }
  return obj;
};

const ShieldContractConstructorBoilerplate = () => {
  const obj = {
      "body": {
          "id": '',
          "nodeType": "Block",
          "src": '',
          "statements": [
              {
                  "expression": {
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "lValueRequested": false,
                      "leftHandSide": {
                          "id": '',
                          "name": "verifier",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": '',
                          "src": '',
                          "typeDescriptions": {
                            // TODO Verifier_Interface type
                          }
                      },
                      "nodeType": "Assignment",
                      "operator": "=",
                      "rightHandSide": {
                        // TODO Verifier_Interface(verifier) goes here
                      },
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                      }
                  },
                  "id": '',
                  "nodeType": "ExpressionStatement",
                  "src": ''
              },
              {
                  "expression": {
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "lValueRequested": false,
                      "leftHandSide": {
                          "baseExpression": {
                              "id": '',
                              "name": "vk",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": '',
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_mapping$_t_uint256_$_t_array$_t_uint256_$dyn_storage_$",
                                  "typeString": "mapping(uint256 => uint256[] storage ref)"
                              }
                          },
                          "id": '',
                          "indexExpression": {
                              "hexValue": "30",
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": true,
                              "kind": "number",
                              "lValueRequested": false,
                              "nodeType": "Literal",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_0_by_1",
                                  "typeString": "int_const 0"
                              },
                              "value": "0"
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": true,
                          "nodeType": "IndexAccess",
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_array$_t_uint256_$dyn_storage",
                              "typeString": "uint256[] storage ref"
                          }
                      },
                      "nodeType": "Assignment",
                      "operator": "=",
                      "rightHandSide": {
                          "id": '',
                          "name": "_vk",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": '',
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                              "typeString": "uint256[] memory"
                          }
                      },
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_array$_t_uint256_$dyn_storage",
                          "typeString": "uint256[] storage ref"
                      }
                  },
                  "id": '',
                  "nodeType": "ExpressionStatement",
                  "src": ''
              }
          ]
      },
      "id": '',
      "implemented": true,
      "kind": "constructor",
      "modifiers": [],
      "name": "",
      "nodeType": "FunctionDefinition",
      "parameters": {
          "id": '',
          "nodeType": "ParameterList",
          "parameters": [
              {
                  "constant": false,
                  "id": '',
                  "mutability": "mutable",
                  "name": "verifierAddress",
                  "nodeType": "VariableDeclaration",
                  "scope": '',
                  "src": '',
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                      "typeIdentifier": "t_address",
                      "typeString": "address"
                  },
                  "typeName": {
                      "id": '',
                      "name": "address",
                      "nodeType": "ElementaryTypeName",
                      "src": '',
                      "stateMutability": "nonpayable",
                      "typeDescriptions": {
                          "typeIdentifier": "t_address",
                          "typeString": "address"
                      }
                  },
                  "visibility": "internal"
              },
              {
                  "constant": false,
                  "id": '',
                  "mutability": "mutable",
                  "name": "_vk",
                  "nodeType": "VariableDeclaration",
                  "scope": '',
                  "src": '',
                  "stateVariable": false,
                  "storageLocation": "memory",
                  "typeDescriptions": {
                      "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                      "typeString": "uint256[]"
                  },
                  "typeName": {
                      "baseType": {
                          "id": '',
                          "name": "uint256",
                          "nodeType": "ElementaryTypeName",
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "id": '',
                      "nodeType": "ArrayTypeName",
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_array$_t_uint256_$dyn_storage_ptr",
                          "typeString": "uint256[]"
                      }
                  },
                  "visibility": "internal"
              }
          ],
          "src": ''
      },
      "returnParameters": {
          "id": '',
          "nodeType": "ParameterList",
          "parameters": [],
          "src": ''
      },
      "scope": '',
      "src": '',
      "stateMutability": "nonpayable",
      "virtual": false,
      "visibility": "public"
  };
  return obj;
};

const ShieldContractMainBoilerplate = () => {
  return {
      "body": {
          "id": '',
          "nodeType": "Block",
          "src": "951:708:0",
          "statements": [
              {
                  "condition": {
                      "commonType": {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                      },
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "lValueRequested": false,
                      "leftExpression": {
                          "commonType": {
                              "typeIdentifier": "t_bool",
                              "typeString": "bool"
                          },
                          "id": '',
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": false,
                          "lValueRequested": false,
                          "leftExpression": {
                              "commonType": {
                                  "typeIdentifier": "t_uint256",
                                  "typeString": "uint256"
                              },
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": false,
                              "lValueRequested": false,
                              "leftExpression": {
                                  "id": '',
                                  "name": "nullifier",
                                  "nodeType": "Identifier",
                                  "overloadedDeclarations": [],
                                  "referencedDeclaration": 75,
                                  "src": "961:9:0",
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_uint256",
                                      "typeString": "uint256"
                                  }
                              },
                              "nodeType": "BinaryOperation",
                              "operator": "==",
                              "rightExpression": {
                                  "hexValue": "30",
                                  "id": '',
                                  "isConstant": false,
                                  "isLValue": false,
                                  "isPure": true,
                                  "kind": "number",
                                  "lValueRequested": false,
                                  "nodeType": "Literal",
                                  "src": "974:1:0",
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_rational_0_by_1",
                                      "typeString": "int_const 0"
                                  },
                                  "value": "0"
                              },
                              "src": "961:14:0",
                              "typeDescriptions": {
                                  "typeIdentifier": "t_bool",
                                  "typeString": "bool"
                              }
                          },
                          "nodeType": "BinaryOperation",
                          "operator": "&&",
                          "rightExpression": {
                              "commonType": {
                                  "typeIdentifier": "t_uint256",
                                  "typeString": "uint256"
                              },
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": false,
                              "lValueRequested": false,
                              "leftExpression": {
                                  "id": '',
                                  "name": "root",
                                  "nodeType": "Identifier",
                                  "overloadedDeclarations": [],
                                  "referencedDeclaration": 73,
                                  "src": "979:4:0",
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_uint256",
                                      "typeString": "uint256"
                                  }
                              },
                              "nodeType": "BinaryOperation",
                              "operator": "==",
                              "rightExpression": {
                                  "hexValue": "30",
                                  "id": '',
                                  "isConstant": false,
                                  "isLValue": false,
                                  "isPure": true,
                                  "kind": "number",
                                  "lValueRequested": false,
                                  "nodeType": "Literal",
                                  "src": "987:1:0",
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_rational_0_by_1",
                                      "typeString": "int_const 0"
                                  },
                                  "value": "0"
                              },
                              "src": "979:9:0",
                              "typeDescriptions": {
                                  "typeIdentifier": "t_bool",
                                  "typeString": "bool"
                              }
                          },
                          "src": "961:27:0",
                          "typeDescriptions": {
                              "typeIdentifier": "t_bool",
                              "typeString": "bool"
                          }
                      },
                      "nodeType": "BinaryOperation",
                      "operator": "&&",
                      "rightExpression": {
                          "commonType": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          },
                          "id": '',
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": false,
                          "lValueRequested": false,
                          "leftExpression": {
                              "id": '',
                              "name": "latestRoot",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 16,
                              "src": "992:10:0",
                              "typeDescriptions": {
                                  "typeIdentifier": "t_uint256",
                                  "typeString": "uint256"
                              }
                          },
                          "nodeType": "BinaryOperation",
                          "operator": "==",
                          "rightExpression": {
                              "hexValue": "30",
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": true,
                              "kind": "number",
                              "lValueRequested": false,
                              "nodeType": "Literal",
                              "src": "1006:1:0",
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_0_by_1",
                                  "typeString": "int_const 0"
                              },
                              "value": "0"
                          },
                          "src": "992:15:0",
                          "typeDescriptions": {
                              "typeIdentifier": "t_bool",
                              "typeString": "bool"
                          }
                      },
                      "src": "961:46:0",
                      "typeDescriptions": {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                      }
                  },
                  "falseBody": {
                      "condition": {
                          "commonType": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          },
                          "id": '',
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": false,
                          "lValueRequested": false,
                          "leftExpression": {
                              "id": '',
                              "name": "nullifier",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 75,
                              "src": "1082:9:0",
                              "typeDescriptions": {
                                  "typeIdentifier": "t_uint256",
                                  "typeString": "uint256"
                              }
                          },
                          "nodeType": "BinaryOperation",
                          "operator": "!=",
                          "rightExpression": {
                              "hexValue": "30",
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": true,
                              "kind": "number",
                              "lValueRequested": false,
                              "nodeType": "Literal",
                              "src": "1095:1:0",
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_0_by_1",
                                  "typeString": "int_const 0"
                              },
                              "value": "0"
                          },
                          "src": "1082:14:0",
                          "typeDescriptions": {
                              "typeIdentifier": "t_bool",
                              "typeString": "bool"
                          }
                      },
                      "falseBody": {
                          "expression": {
                              "arguments": [
                                  {
                                      "hexValue": "4e756c6c696669657220666f72206c617465737420636f6d6d69746d656e74206e6f7420646566696e6564",
                                      "id": '',
                                      "isConstant": false,
                                      "isLValue": false,
                                      "isPure": true,
                                      "kind": "string",
                                      "lValueRequested": false,
                                      "nodeType": "Literal",
                                      "src": "1289:45:0",
                                      "typeDescriptions": {
                                          "typeIdentifier": "t_stringliteral_cb275527d9f77165917a69e805e359593de0688f58e967d3745e566acdf505a3",
                                          "typeString": "literal_string \"Nullifier for latest commitment not defined\""
                                      },
                                      "value": "Nullifier for latest commitment not defined"
                                  }
                              ],
                              "expression": {
                                  "argumentTypes": [
                                      {
                                          "typeIdentifier": "t_stringliteral_cb275527d9f77165917a69e805e359593de0688f58e967d3745e566acdf505a3",
                                          "typeString": "literal_string \"Nullifier for latest commitment not defined\""
                                      }
                                  ],
                                  "id": '',
                                  "name": "revert",
                                  "nodeType": "Identifier",
                                  "overloadedDeclarations": [
                                      -19,
                                      -19
                                  ],
                                  "referencedDeclaration": -19,
                                  "src": "1282:6:0",
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_function_revert_pure$_t_string_memory_ptr_$returns$__$",
                                      "typeString": "function (string memory) pure"
                                  }
                              },
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": false,
                              "kind": "functionCall",
                              "lValueRequested": false,
                              "names": [],
                              "nodeType": "FunctionCall",
                              "src": "1282:53:0",
                              "tryCall": false,
                              "typeDescriptions": {
                                  "typeIdentifier": "t_tuple$__$",
                                  "typeString": "tuple()"
                              }
                          },
                          "id": '',
                          "nodeType": "ExpressionStatement",
                          "src": "1282:53:0"
                      },
                      "id": '',
                      "nodeType": "IfStatement",
                      "src": "1078:257:0",
                      "trueBody": {
                          "id": '',
                          "nodeType": "Block",
                          "src": "1098:178:0",
                          "statements": [
                              {
                                  "expression": {
                                      "arguments": [
                                          {
                                              "commonType": {
                                                  "typeIdentifier": "t_uint256",
                                                  "typeString": "uint256"
                                              },
                                              "id": '',
                                              "isConstant": false,
                                              "isLValue": false,
                                              "isPure": false,
                                              "lValueRequested": false,
                                              "leftExpression": {
                                                  "baseExpression": {
                                                      "id": '',
                                                      "name": "nullifiers",
                                                      "nodeType": "Identifier",
                                                      "overloadedDeclarations": [],
                                                      "referencedDeclaration": 5,
                                                      "src": "1114:10:0",
                                                      "typeDescriptions": {
                                                          "typeIdentifier": "t_mapping$_t_uint256_$_t_uint256_$",
                                                          "typeString": "mapping(uint256 => uint256)"
                                                      }
                                                  },
                                                  "id": '',
                                                  "indexExpression": {
                                                      "id": '',
                                                      "name": "nullifier",
                                                      "nodeType": "Identifier",
                                                      "overloadedDeclarations": [],
                                                      "referencedDeclaration": 75,
                                                      "src": "1125:9:0",
                                                      "typeDescriptions": {
                                                          "typeIdentifier": "t_uint256",
                                                          "typeString": "uint256"
                                                      }
                                                  },
                                                  "isConstant": false,
                                                  "isLValue": true,
                                                  "isPure": false,
                                                  "lValueRequested": false,
                                                  "nodeType": "IndexAccess",
                                                  "src": "1114:21:0",
                                                  "typeDescriptions": {
                                                      "typeIdentifier": "t_uint256",
                                                      "typeString": "uint256"
                                                  }
                                              },
                                              "nodeType": "BinaryOperation",
                                              "operator": "==",
                                              "rightExpression": {
                                                  "hexValue": "30",
                                                  "id": '',
                                                  "isConstant": false,
                                                  "isLValue": false,
                                                  "isPure": true,
                                                  "kind": "number",
                                                  "lValueRequested": false,
                                                  "nodeType": "Literal",
                                                  "src": "1139:1:0",
                                                  "typeDescriptions": {
                                                      "typeIdentifier": "t_rational_0_by_1",
                                                      "typeString": "int_const 0"
                                                  },
                                                  "value": "0"
                                              },
                                              "src": "1114:26:0",
                                              "typeDescriptions": {
                                                  "typeIdentifier": "t_bool",
                                                  "typeString": "bool"
                                              }
                                          },
                                          {
                                              "hexValue": "4e756c6c696669657220616c726561647920657869737473",
                                              "id": '',
                                              "isConstant": false,
                                              "isLValue": false,
                                              "isPure": true,
                                              "kind": "string",
                                              "lValueRequested": false,
                                              "nodeType": "Literal",
                                              "src": "1142:26:0",
                                              "typeDescriptions": {
                                                  "typeIdentifier": "t_stringliteral_c8b26daba8385f98b779801b3ad0821109528d5c73a92c80f9e80122b99cf991",
                                                  "typeString": "literal_string \"Nullifier already exists\""
                                              },
                                              "value": "Nullifier already exists"
                                          }
                                      ],
                                      "expression": {
                                          "argumentTypes": [
                                              {
                                                  "typeIdentifier": "t_bool",
                                                  "typeString": "bool"
                                              },
                                              {
                                                  "typeIdentifier": "t_stringliteral_c8b26daba8385f98b779801b3ad0821109528d5c73a92c80f9e80122b99cf991",
                                                  "typeString": "literal_string \"Nullifier already exists\""
                                              }
                                          ],
                                          "id": '',
                                          "name": "require",
                                          "nodeType": "Identifier",
                                          "overloadedDeclarations": [
                                              -18,
                                              -18
                                          ],
                                          "referencedDeclaration": -18,
                                          "src": "1106:7:0",
                                          "typeDescriptions": {
                                              "typeIdentifier": "t_function_require_pure$_t_bool_$_t_string_memory_ptr_$returns$__$",
                                              "typeString": "function (bool,string memory) pure"
                                          }
                                      },
                                      "id": '',
                                      "isConstant": false,
                                      "isLValue": false,
                                      "isPure": false,
                                      "kind": "functionCall",
                                      "lValueRequested": false,
                                      "names": [],
                                      "nodeType": "FunctionCall",
                                      "src": "1106:63:0",
                                      "tryCall": false,
                                      "typeDescriptions": {
                                          "typeIdentifier": "t_tuple$__$",
                                          "typeString": "tuple()"
                                      }
                                  },
                                  "id": '',
                                  "nodeType": "ExpressionStatement",
                                  "src": "1106:63:0"
                              },
                              {
                                  "expression": {
                                      "arguments": [
                                          {
                                              "commonType": {
                                                  "typeIdentifier": "t_uint256",
                                                  "typeString": "uint256"
                                              },
                                              "id": '',
                                              "isConstant": false,
                                              "isLValue": false,
                                              "isPure": false,
                                              "lValueRequested": false,
                                              "leftExpression": {
                                                  "baseExpression": {
                                                      "id": '',
                                                      "name": "roots",
                                                      "nodeType": "Identifier",
                                                      "overloadedDeclarations": [],
                                                      "referencedDeclaration": 9,
                                                      "src": "1185:5:0",
                                                      "typeDescriptions": {
                                                          "typeIdentifier": "t_mapping$_t_uint256_$_t_uint256_$",
                                                          "typeString": "mapping(uint256 => uint256)"
                                                      }
                                                  },
                                                  "id": '',
                                                  "indexExpression": {
                                                      "id": '',
                                                      "name": "root",
                                                      "nodeType": "Identifier",
                                                      "overloadedDeclarations": [],
                                                      "referencedDeclaration": 73,
                                                      "src": "1191:4:0",
                                                      "typeDescriptions": {
                                                          "typeIdentifier": "t_uint256",
                                                          "typeString": "uint256"
                                                      }
                                                  },
                                                  "isConstant": false,
                                                  "isLValue": true,
                                                  "isPure": false,
                                                  "lValueRequested": false,
                                                  "nodeType": "IndexAccess",
                                                  "src": "1185:11:0",
                                                  "typeDescriptions": {
                                                      "typeIdentifier": "t_uint256",
                                                      "typeString": "uint256"
                                                  }
                                              },
                                              "nodeType": "BinaryOperation",
                                              "operator": "==",
                                              "rightExpression": {
                                                  "id": '',
                                                  "name": "root",
                                                  "nodeType": "Identifier",
                                                  "overloadedDeclarations": [],
                                                  "referencedDeclaration": 73,
                                                  "src": "1200:4:0",
                                                  "typeDescriptions": {
                                                      "typeIdentifier": "t_uint256",
                                                      "typeString": "uint256"
                                                  }
                                              },
                                              "src": "1185:19:0",
                                              "typeDescriptions": {
                                                  "typeIdentifier": "t_bool",
                                                  "typeString": "bool"
                                              }
                                          },
                                          {
                                              "hexValue": "526f6f7420646f6573206e6f74206578697374",
                                              "id": '',
                                              "isConstant": false,
                                              "isLValue": false,
                                              "isPure": true,
                                              "kind": "string",
                                              "lValueRequested": false,
                                              "nodeType": "Literal",
                                              "src": "1206:21:0",
                                              "typeDescriptions": {
                                                  "typeIdentifier": "t_stringliteral_ad7ecf2adb23a091a9c01bdae7fb1b18a3a12c15e41cfafded464e944aa5faec",
                                                  "typeString": "literal_string \"Root does not exist\""
                                              },
                                              "value": "Root does not exist"
                                          }
                                      ],
                                      "expression": {
                                          "argumentTypes": [
                                              {
                                                  "typeIdentifier": "t_bool",
                                                  "typeString": "bool"
                                              },
                                              {
                                                  "typeIdentifier": "t_stringliteral_ad7ecf2adb23a091a9c01bdae7fb1b18a3a12c15e41cfafded464e944aa5faec",
                                                  "typeString": "literal_string \"Root does not exist\""
                                              }
                                          ],
                                          "id": '',
                                          "name": "require",
                                          "nodeType": "Identifier",
                                          "overloadedDeclarations": [
                                              -18,
                                              -18
                                          ],
                                          "referencedDeclaration": -18,
                                          "src": "1177:7:0",
                                          "typeDescriptions": {
                                              "typeIdentifier": "t_function_require_pure$_t_bool_$_t_string_memory_ptr_$returns$__$",
                                              "typeString": "function (bool,string memory) pure"
                                          }
                                      },
                                      "id": '',
                                      "isConstant": false,
                                      "isLValue": false,
                                      "isPure": false,
                                      "kind": "functionCall",
                                      "lValueRequested": false,
                                      "names": [],
                                      "nodeType": "FunctionCall",
                                      "src": "1177:51:0",
                                      "tryCall": false,
                                      "typeDescriptions": {
                                          "typeIdentifier": "t_tuple$__$",
                                          "typeString": "tuple()"
                                      }
                                  },
                                  "id": '',
                                  "nodeType": "ExpressionStatement",
                                  "src": "1177:51:0"
                              },
                              {
                                  "expression": {
                                      "id": '',
                                      "isConstant": false,
                                      "isLValue": false,
                                      "isPure": false,
                                      "lValueRequested": false,
                                      "leftHandSide": {
                                          "baseExpression": {
                                              "id": '',
                                              "name": "nullifiers",
                                              "nodeType": "Identifier",
                                              "overloadedDeclarations": [],
                                              "referencedDeclaration": 5,
                                              "src": "1236:10:0",
                                              "typeDescriptions": {
                                                  "typeIdentifier": "t_mapping$_t_uint256_$_t_uint256_$",
                                                  "typeString": "mapping(uint256 => uint256)"
                                              }
                                          },
                                          "id": '',
                                          "indexExpression": {
                                              "id": '',
                                              "name": "nullifier",
                                              "nodeType": "Identifier",
                                              "overloadedDeclarations": [],
                                              "referencedDeclaration": 75,
                                              "src": "1247:9:0",
                                              "typeDescriptions": {
                                                  "typeIdentifier": "t_uint256",
                                                  "typeString": "uint256"
                                              }
                                          },
                                          "isConstant": false,
                                          "isLValue": true,
                                          "isPure": false,
                                          "lValueRequested": true,
                                          "nodeType": "IndexAccess",
                                          "src": "1236:21:0",
                                          "typeDescriptions": {
                                              "typeIdentifier": "t_uint256",
                                              "typeString": "uint256"
                                          }
                                      },
                                      "nodeType": "Assignment",
                                      "operator": "=",
                                      "rightHandSide": {
                                          "id": '',
                                          "name": "nullifier",
                                          "nodeType": "Identifier",
                                          "overloadedDeclarations": [],
                                          "referencedDeclaration": 75,
                                          "src": "1260:9:0",
                                          "typeDescriptions": {
                                              "typeIdentifier": "t_uint256",
                                              "typeString": "uint256"
                                          }
                                      },
                                      "src": "1236:33:0",
                                      "typeDescriptions": {
                                          "typeIdentifier": "t_uint256",
                                          "typeString": "uint256"
                                      }
                                  },
                                  "id": '',
                                  "nodeType": "ExpressionStatement",
                                  "src": "1236:33:0"
                              }
                          ]
                      }
                  },
                  "id": '',
                  "nodeType": "IfStatement",
                  "src": "957:378:0",
                  "trueBody": {
                      "id": '',
                      "nodeType": "Block",
                      "src": "1009:63:0",
                      "statements": []
                  }
              },
              {
                  "assignments": [
                      130
                  ],
                  "declarations": [
                      {
                          "constant": false,
                          "id": '',
                          "mutability": "mutable",
                          "name": "inputs",
                          "nodeType": "VariableDeclaration",
                          "scope": '',
                          "src": '',
                          "stateVariable": false,
                          "storageLocation": "memory",
                          "typeDescriptions": {
                              "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                              "typeString": "uint256[]"
                          },
                          "typeName": {
                              "baseType": {
                                  "id": '',
                                  "name": "uint256",
                                  "nodeType": "ElementaryTypeName",
                                  "src": '',
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_uint256",
                                      "typeString": "uint256"
                                  }
                              },
                              "id": '',
                              "nodeType": "ArrayTypeName",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_storage_ptr",
                                  "typeString": "uint256[]"
                              }
                          },
                          "visibility": "internal"
                      }
                  ],
                  "id": '',
                  "initialValue": {
                      "arguments": [
                          {
                              "hexValue": "33",
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": true,
                              "kind": "number",
                              "lValueRequested": false,
                              "nodeType": "Literal",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_3_by_1",
                                  "typeString": "int_const 3"
                              },
                              "value": "3"
                          }
                      ],
                      "expression": {
                          "argumentTypes": [
                              {
                                  "typeIdentifier": "t_rational_3_by_1",
                                  "typeString": "int_const 3"
                              }
                          ],
                          "id": '',
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": true,
                          "lValueRequested": false,
                          "nodeType": "NewExpression",
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_function_objectcreation_pure$_t_uint256_$returns$_t_array$_t_uint256_$dyn_memory_ptr_$",
                              "typeString": "function (uint256) pure returns (uint256[] memory)"
                          },
                          "typeName": {
                              "baseType": {
                                  "id": '',
                                  "name": "uint256",
                                  "nodeType": "ElementaryTypeName",
                                  "src": '',
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_uint256",
                                      "typeString": "uint256"
                                  }
                              },
                              "id": '',
                              "nodeType": "ArrayTypeName",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_storage_ptr",
                                  "typeString": "uint256[]"
                              }
                          }
                      },
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": true,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": '',
                      "tryCall": false,
                      "typeDescriptions": {
                          "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                          "typeString": "uint256[] memory"
                      }
                  },
                  "nodeType": "VariableDeclarationStatement",
                  "src": "1342:42:0"
              },
              {
                  "expression": {
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "lValueRequested": false,
                      "leftHandSide": {
                          "baseExpression": {
                              "id": '',
                              "name": "inputs",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 130,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                                  "typeString": "uint256[] memory"
                              }
                          },
                          "id": '',
                          "indexExpression": {
                              "hexValue": "30",
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": true,
                              "kind": "number",
                              "lValueRequested": false,
                              "nodeType": "Literal",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_0_by_1",
                                  "typeString": "int_const 0"
                              },
                              "value": "0"
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": true,
                          "nodeType": "IndexAccess",
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "nodeType": "Assignment",
                      "operator": "=",
                      "rightHandSide": {
                          "id": '',
                          "name": "root",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 73,
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                      }
                  },
                  "id": '',
                  "nodeType": "ExpressionStatement",
                  "src": "1390:16:0"
              },
              {
                  "expression": {
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "lValueRequested": false,
                      "leftHandSide": {
                          "baseExpression": {
                              "id": '',
                              "name": "inputs",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 130,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                                  "typeString": "uint256[] memory"
                              }
                          },
                          "id": '',
                          "indexExpression": {
                              "hexValue": "31",
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": true,
                              "kind": "number",
                              "lValueRequested": false,
                              "nodeType": "Literal",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_1_by_1",
                                  "typeString": "int_const 1"
                              },
                              "value": "1"
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": true,
                          "nodeType": "IndexAccess",
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "nodeType": "Assignment",
                      "operator": "=",
                      "rightHandSide": {
                          "id": '',
                          "name": "nullifier",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 75,
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                      }
                  },
                  "id": '',
                  "nodeType": "ExpressionStatement",
                  "src": "1412:21:0"
              },
              {
                  "expression": {
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "lValueRequested": false,
                      "leftHandSide": {
                          "baseExpression": {
                              "id": '',
                              "name": "inputs",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 130,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                                  "typeString": "uint256[] memory"
                              }
                          },
                          "id": '',
                          "indexExpression": {
                              "hexValue": "32",
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": true,
                              "kind": "number",
                              "lValueRequested": false,
                              "nodeType": "Literal",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_2_by_1",
                                  "typeString": "int_const 2"
                              },
                              "value": "2"
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": true,
                          "nodeType": "IndexAccess",
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "nodeType": "Assignment",
                      "operator": "=",
                      "rightHandSide": {
                          "id": '',
                          "name": "commitment",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 77,
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                      }
                  },
                  "id": '',
                  "nodeType": "ExpressionStatement",
                  "src": "1439:22:0"
              },
              {
                  "assignments": [
                      156
                  ],
                  "declarations": [
                      {
                          "constant": false,
                          "id": '',
                          "mutability": "mutable",
                          "name": "res",
                          "nodeType": "VariableDeclaration",
                          "scope": '',
                          "src": '',
                          "stateVariable": false,
                          "storageLocation": "default",
                          "typeDescriptions": {
                              "typeIdentifier": "t_bool",
                              "typeString": "bool"
                          },
                          "typeName": {
                              "id": '',
                              "name": "bool",
                              "nodeType": "ElementaryTypeName",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_bool",
                                  "typeString": "bool"
                              }
                          },
                          "visibility": "internal"
                      }
                  ],
                  "id": '',
                  "initialValue": {
                      "arguments": [
                          {
                              "id": '',
                              "name": "proof",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 71,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                                  "typeString": "uint256[] memory"
                              }
                          },
                          {
                              "id": '',
                              "name": "inputs",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 130,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                                  "typeString": "uint256[] memory"
                              }
                          },
                          {
                              "baseExpression": {
                                  "id": '',
                                  "name": "vk",
                                  "nodeType": "Identifier",
                                  "overloadedDeclarations": [],
                                  "referencedDeclaration": 14,
                                  "src": '',
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_mapping$_t_uint256_$_t_array$_t_uint256_$dyn_storage_$",
                                      "typeString": "mapping(uint256 => uint256[] storage ref)"
                                  }
                              },
                              "id": '',
                              "indexExpression": {
                                  "hexValue": "30",
                                  "id": '',
                                  "isConstant": false,
                                  "isLValue": false,
                                  "isPure": true,
                                  "kind": "number",
                                  "lValueRequested": false,
                                  "nodeType": "Literal",
                                  "src": '',
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_rational_0_by_1",
                                      "typeString": "int_const 0"
                                  },
                                  "value": "0"
                              },
                              "isConstant": false,
                              "isLValue": true,
                              "isPure": false,
                              "lValueRequested": false,
                              "nodeType": "IndexAccess",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_storage",
                                  "typeString": "uint256[] storage ref"
                              }
                          }
                      ],
                      "expression": {
                          "argumentTypes": [
                              {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                                  "typeString": "uint256[] memory"
                              },
                              {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                                  "typeString": "uint256[] memory"
                              },
                              {
                                  "typeIdentifier": "t_array$_t_uint256_$dyn_storage",
                                  "typeString": "uint256[] storage ref"
                              }
                          ],
                          "id": '',
                          "name": "verify",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 54,
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_function_internal_nonpayable$_t_array$_t_uint256_$dyn_memory_ptr_$_t_array$_t_uint256_$dyn_memory_ptr_$_t_array$_t_uint256_$dyn_memory_ptr_$returns$_t_bool_$",
                              "typeString": "function (uint256[] memory,uint256[] memory,uint256[] memory) returns (bool)"
                          }
                      },
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": '',
                      "tryCall": false,
                      "typeDescriptions": {
                          "typeIdentifier": "t_bool",
                          "typeString": "bool"
                      }
                  },
                  "nodeType": "VariableDeclarationStatement",
                  "src": "1468:39:0"
              },
              {
                  "expression": {
                      "arguments": [
                          {
                              "id": '',
                              "name": "res",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 156,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_bool",
                                  "typeString": "bool"
                              }
                          },
                          {
                              "hexValue": "5468652070726f6f6620686173206e6f74206265656e2076657269666965642062792074686520636f6e7472616374",
                              "id": '',
                              "isConstant": false,
                              "isLValue": false,
                              "isPure": true,
                              "kind": "string",
                              "lValueRequested": false,
                              "nodeType": "Literal",
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_stringliteral_454435e9b46516292e6184fc14c0b11166b30c662b1918df84ad088cbfb9429f",
                                  "typeString": "literal_string \"The proof has not been verified by the contract\""
                              },
                              "value": "The proof has not been verified by the contract"
                          }
                      ],
                      "expression": {
                          "argumentTypes": [
                              {
                                  "typeIdentifier": "t_bool",
                                  "typeString": "bool"
                              },
                              {
                                  "typeIdentifier": "t_stringliteral_454435e9b46516292e6184fc14c0b11166b30c662b1918df84ad088cbfb9429f",
                                  "typeString": "literal_string \"The proof has not been verified by the contract\""
                              }
                          ],
                          "id": '',
                          "name": "require",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [
                              -18,
                              -18
                          ],
                          "referencedDeclaration": -18,
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_function_require_pure$_t_bool_$_t_string_memory_ptr_$returns$__$",
                              "typeString": "function (bool,string memory) pure"
                          }
                      },
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "kind": "functionCall",
                      "lValueRequested": false,
                      "names": [],
                      "nodeType": "FunctionCall",
                      "src": '',
                      "tryCall": false,
                      "typeDescriptions": {
                          "typeIdentifier": "t_tuple$__$",
                          "typeString": "tuple()"
                      }
                  },
                  "id": '',
                  "nodeType": "ExpressionStatement",
                  "src": "1513:63:0"
              },
              {
                  "expression": {
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "lValueRequested": false,
                      "leftHandSide": {
                          "id": '',
                          "name": "latestRoot",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 16,
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "nodeType": "Assignment",
                      "operator": "=",
                      "rightHandSide": {
                          "arguments": [
                              {
                                  "id": '',
                                  "name": "commitment",
                                  "nodeType": "Identifier",
                                  "overloadedDeclarations": [],
                                  "referencedDeclaration": 77,
                                  "src": '',
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_uint256",
                                      "typeString": "uint256"
                                  }
                              }
                          ],
                          "expression": {
                              "argumentTypes": [
                                  {
                                      "typeIdentifier": "t_uint256",
                                      "typeString": "uint256"
                                  }
                              ],
                              "id": '',
                              "name": "insertLeaf",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 68,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_function_internal_nonpayable$_t_uint256_$returns$_t_uint256_$",
                                  "typeString": "function (uint256) returns (uint256)"
                              }
                          },
                          "id": '',
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": false,
                          "kind": "functionCall",
                          "lValueRequested": false,
                          "names": [],
                          "nodeType": "FunctionCall",
                          "src": '',
                          "tryCall": false,
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                      }
                  },
                  "id": '',
                  "nodeType": "ExpressionStatement",
                  "src": "1583:35:0"
              },
              {
                  "expression": {
                      "id": '',
                      "isConstant": false,
                      "isLValue": false,
                      "isPure": false,
                      "lValueRequested": false,
                      "leftHandSide": {
                          "baseExpression": {
                              "id": '',
                              "name": "roots",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 9,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_mapping$_t_uint256_$_t_uint256_$",
                                  "typeString": "mapping(uint256 => uint256)"
                              }
                          },
                          "id": '',
                          "indexExpression": {
                              "id": '',
                              "name": "latestRoot",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 16,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_uint256",
                                  "typeString": "uint256"
                              }
                          },
                          "isConstant": false,
                          "isLValue": true,
                          "isPure": false,
                          "lValueRequested": true,
                          "nodeType": "IndexAccess",
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "nodeType": "Assignment",
                      "operator": "=",
                      "rightHandSide": {
                          "id": '',
                          "name": "latestRoot",
                          "nodeType": "Identifier",
                          "overloadedDeclarations": [],
                          "referencedDeclaration": 16,
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                      }
                  },
                  "id": '',
                  "nodeType": "ExpressionStatement",
                  "src": "1624:30:0"
              }
          ]
      },
      "functionSelector": "a68e0949",
      "id": '',
      "implemented": true,
      "kind": "function",
      "modifiers": [],
      "name": "assign",
      "nodeType": "FunctionDefinition",
      "parameters": {
          "id": '',
          "nodeType": "ParameterList",
          "parameters": [
              {
                  "constant": false,
                  "id": '',
                  "mutability": "mutable",
                  "name": "proof",
                  "nodeType": "VariableDeclaration",
                  "scope": '',
                  "src": '',
                  "stateVariable": false,
                  "storageLocation": "memory",
                  "typeDescriptions": {
                      "typeIdentifier": "t_array$_t_uint256_$dyn_memory_ptr",
                      "typeString": "uint256[]"
                  },
                  "typeName": {
                      "baseType": {
                          "id": '',
                          "name": "uint256",
                          "nodeType": "ElementaryTypeName",
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_uint256",
                              "typeString": "uint256"
                          }
                      },
                      "id": '',
                      "nodeType": "ArrayTypeName",
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_array$_t_uint256_$dyn_storage_ptr",
                          "typeString": "uint256[]"
                      }
                  },
                  "visibility": "internal"
              },
              {
                  "constant": false,
                  "id": '',
                  "mutability": "mutable",
                  "name": "root",
                  "nodeType": "VariableDeclaration",
                  "scope": '',
                  "src": '',
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                  },
                  "typeName": {
                      "id": '',
                      "name": "uint256",
                      "nodeType": "ElementaryTypeName",
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                      }
                  },
                  "visibility": "internal"
              },
              {
                  "constant": false,
                  "id": '',
                  "mutability": "mutable",
                  "name": "nullifier",
                  "nodeType": "VariableDeclaration",
                  "scope": '',
                  "src": '',
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                  },
                  "typeName": {
                      "id": '',
                      "name": "uint256",
                      "nodeType": "ElementaryTypeName",
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                      }
                  },
                  "visibility": "internal"
              },
              {
                  "constant": false,
                  "id": '',
                  "mutability": "mutable",
                  "name": "commitment",
                  "nodeType": "VariableDeclaration",
                  "scope": '',
                  "src": '',
                  "stateVariable": false,
                  "storageLocation": "default",
                  "typeDescriptions": {
                      "typeIdentifier": "t_uint256",
                      "typeString": "uint256"
                  },
                  "typeName": {
                      "id": '',
                      "name": "uint256",
                      "nodeType": "ElementaryTypeName",
                      "src": '',
                      "typeDescriptions": {
                          "typeIdentifier": "t_uint256",
                          "typeString": "uint256"
                      }
                  },
                  "visibility": "internal"
              }
          ],
          "src": "866:77:0"
      },
      "returnParameters": {
          "id": '',
          "nodeType": "ParameterList",
          "parameters": [],
          "src": "951:0:0"
      },
      "scope": '',
      "src": '',
      "stateMutability": "nonpayable",
      "virtual": false,
      "visibility": "public"
  };
};

function codeGenerator(node) {
  // We'll break things down by the `type` of the `node`.
  switch (node.nodeType) {
    case 'Folder':
      return node.files.map(codeGenerator).join('\n\n');

    case 'File':
      return node.nodes.map(codeGenerator).join('\n\n');

    case 'ImportStatements':
      return `${node.imports.map(codeGenerator).join('\n')}`;

    case 'EditableCommitmentImportsBoilerplate':
      return EditableCommitmentImportsBoilerplate.join('\n');

    case 'FunctionDefinition': {
      const functionSignature = `def main(\\\n\t${codeGenerator(node.parameters)}\\\n) -> ():`;
      const body = codeGenerator(node.body);
      return `${functionSignature}\n\n\t${body}\n\n\treturn`;
    }

    case 'ParameterList':
      return node.parameters.map(codeGenerator).join(',\\\n\t');

    case 'VariableDeclaration': {
      const isPrivate = node.isPrivate ? 'private ' : '';
      return `${isPrivate}${codeGenerator(node.typeName)} ${node.name}`;
    }

    case 'ElementaryTypeName':
      return node.name;

    case 'Block':
      return node.statements.map(codeGenerator).join('\n\n\t');

    case 'ExpressionStatement':
      return codeGenerator(node.expression);

    case 'Assignment':
      return `${codeGenerator(node.leftHandSide)} ${node.operator} ${codeGenerator(
        node.rightHandSide,
      )}`;

    case 'Identifier':
      return node.name;

    case 'EditableCommitmentStatementsBoilerplate':
      return EditableCommitmentStatementsBoilerplate(node.privateStateName).join('\n\n\t');

    // And if we haven't recognized the node, we'll throw an error.
    default:
      return;
      // throw new TypeError(node.type); // comment out the error until we've written all of the many possible types
  }
}

export { codeGenerator as default };
