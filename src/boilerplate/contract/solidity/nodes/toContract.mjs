/* eslint-disable prettier/prettier, no-use-before-define */
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
            "0.8",
            ".0"
        ],
        "nodeType": "PragmaDirective",
        "src": ''
      };
    case 'ImportDirective':
     // nodes for imports - live in sourceUnit.nodes
     return [{
           "absolutePath": "merkle-tree/MerkleTree.sol",
           "file": "./merkle-tree/MerkleTree.sol",
           "id": '',
           "nodeType": "ImportDirective",
           "scope": '',
           "sourceUnit": '', // 852
           "src": '',
           "symbolAliases": [],
           "unitAlias": ""
       },
       {
           "absolutePath": "verify/Verifier_Interface.sol",
           "file": "./verify/Verifier_Interface.sol",
           "id": '',
           "nodeType": "ImportDirective",
           "scope": '',
           "sourceUnit": '',
           "src": '',
           "symbolAliases": [],
           "unitAlias": ""
       }];
    case 'ContractDefinition':
      return {
        "abstract": false,
        "baseContracts": [{ // imported contracts which act as a 'base' - ie contract is MerkleTree:
            "baseName": {
                "id": '',
                "name": "MerkleTree",
                "nodeType": "UserDefinedTypeName",
                "referencedDeclaration": '',
                "src": '',
                "typeDescriptions": {
                    "typeIdentifier": "t_contract$_MerkleTree_$851", // 851 = referencedDeclaration
                    // DOESNT refer to an id - but the SU of this is 852
                    "typeString": "contract MerkleTree"
                }
            },
            "id": 5,
            "nodeType": "InheritanceSpecifier",
            "src": "172:10:0"
        }],
        "contractDependencies": [],
        "contractKind": "contract",
        "fullyImplemented": true,
        "id": dummyId,
        "linearizedBaseContracts": [],
        "name": "AssignShield",
        "nodeType": "ContractDefinition",
        "nodes": [], // we push to this
        "scope": '', // This would be the id of the SourceUnit
        "src": '' // line no.
      };
    case 'Globals':
      const mappings = [];
      mappings.push(ShieldContractMappingBoilerplate('nullifiers', 'uint256'));
      mappings.push(ShieldContractMappingBoilerplate('commitmentRoots', 'uint256'));
      mappings.push(ShieldContractMappingBoilerplate('vk', 'uint256', 'uint256[]'));
      mappings.push({
        "constant": false,
        "id": '',
        "mutability": "mutable",
        "name": "verifier",
        "nodeType": "VariableDeclaration",
        "scope": '',
        "src": '',
        "stateVariable": true,
        "storageLocation": "default",
        "typeDescriptions": {
            "typeIdentifier": "t_contract$_Verifier_Interface_$868", // TODO set 868 = referencedDeclaration below
            "typeString": "contract Verifier_Interface"
        },
        "typeName": {
            "id": '',
            "name": "Verifier_Interface",
            "nodeType": "UserDefinedTypeName",
            "referencedDeclaration": '',
            "src": '',
            "typeDescriptions": {
                "typeIdentifier": "t_contract$_Verifier_Interface_$868",
                "typeString": "contract Verifier_Interface"
            }
        },
        "visibility": "private"
    });
      return mappings;
    case 'Constructor':
      return ShieldContractConstructorBoilerplate();
    case 'Main':
      return ShieldContractMainBoilerplate();
    default:
      return;
  }

};

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
                            "typeIdentifier": "t_contract$_Verifier_Interface_$868", // 868 = referencedDeclaration
                            "typeString": "contract Verifier_Interface"
                          }
                      },
                      "nodeType": "Assignment",
                      "operator": "=",
                      "rightHandSide": {
                        "arguments": [
                            {
                                "id": '',
                                "name": "verifierAddress",
                                "nodeType": "Identifier",
                                "overloadedDeclarations": [],
                                "referencedDeclaration": '24',
                                "src": '',
                                "typeDescriptions": {
                                    "typeIdentifier": "t_address",
                                    "typeString": "address"
                                }
                            }
                        ],
                        "expression": {
                            "argumentTypes": [
                                {
                                    "typeIdentifier": "t_address",
                                    "typeString": "address"
                                }
                            ],
                            "id": '',
                            "name": "Verifier_Interface",
                            "nodeType": "Identifier",
                            "overloadedDeclarations": [],
                            "referencedDeclaration": '',
                            "src": '',
                            "typeDescriptions": {
                                "typeIdentifier": "t_type$_t_contract$_Verifier_Interface_$868_$",  // 868 = referencedDeclaration
                                "typeString": "type(contract Verifier_Interface)"
                            }
                        },
                        "id": '',
                        "isConstant": false,
                        "isLValue": false,
                        "isPure": false,
                        "kind": "typeConversion",
                        "lValueRequested": false,
                        "names": [],
                        "nodeType": "FunctionCall",
                        "src": '',
                        "tryCall": false,
                        "typeDescriptions": {
                            "typeIdentifier": "t_contract$_Verifier_Interface_$868", // 868 = referencedDeclaration
                            "typeString": "contract Verifier_Interface"
                        }
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
          "src": '',
          "statements": [
              {
                  "condition": {
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
                                  "referencedDeclaration": 50,
                                  "src": '',
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
                                  "src": '',
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_rational_0_by_1",
                                      "typeString": "int_const 0"
                                  },
                                  "value": "0"
                              },
                              "src": '',
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
                                  "referencedDeclaration": 48,
                                  "src": '',
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
                                  "src": '',
                                  "typeDescriptions": {
                                      "typeIdentifier": "t_rational_0_by_1",
                                      "typeString": "int_const 0"
                                  },
                                  "value": "0"
                              },
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_bool",
                                  "typeString": "bool"
                              }
                          },
                          "src": '',
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
                              "referencedDeclaration": 22,
                              "src": '',
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
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_0_by_1",
                                  "typeString": "int_const 0"
                              },
                              "value": "0"
                          },
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_bool",
                              "typeString": "bool"
                          }
                      },
                      "src": '',
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
                              "referencedDeclaration": 50,
                              "src": '',
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
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_rational_0_by_1",
                                  "typeString": "int_const 0"
                              },
                              "value": "0"
                          },
                          "src": '',
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
                                      "src": '',
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
                                  "src": '',
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
                              "src": '',
                              "tryCall": false,
                              "typeDescriptions": {
                                  "typeIdentifier": "t_tuple$__$",
                                  "typeString": "tuple()"
                              }
                          },
                          "id": '',
                          "nodeType": "ExpressionStatement",
                          "src": "999:53:0"
                      },
                      "id": '',
                      "nodeType": "IfStatement",
                      "src": '',
                      "trueBody": {
                          "id": '',
                          "nodeType": "Block",
                          "src": '',
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
                                                      "referencedDeclaration": 11,
                                                      "src": '',
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
                                                      "referencedDeclaration": 50,
                                                      "src": '',
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
                                                  "src": '',
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
                                                  "src": '',
                                                  "typeDescriptions": {
                                                      "typeIdentifier": "t_rational_0_by_1",
                                                      "typeString": "int_const 0"
                                                  },
                                                  "value": "0"
                                              },
                                              "src": '',
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
                                              "src": '',
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
                                  "src": "820:63:0"
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
                                                      "referencedDeclaration": 15,
                                                      "src": '',
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
                                                      "referencedDeclaration": 48,
                                                      "src": '',
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
                                                  "src": '',
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
                                                  "referencedDeclaration": 48,
                                                  "src": '',
                                                  "typeDescriptions": {
                                                      "typeIdentifier": "t_uint256",
                                                      "typeString": "uint256"
                                                  }
                                              },
                                              "src": '',
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
                                              "src": '',
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
                                  "src": "892:51:0"
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
                                              "referencedDeclaration": 11,
                                              "src": '',
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
                                              "referencedDeclaration": 50,
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
                                          "name": "nullifier",
                                          "nodeType": "Identifier",
                                          "overloadedDeclarations": [],
                                          "referencedDeclaration": 50,
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
                                  "src": "952:33:0"
                              }
                          ]
                      }
                  },
                  "id": '',
                  "nodeType": "IfStatement",
                  "src": '',
                  "trueBody": {
                      "id": '',
                      "nodeType": "Block",
                      "src": '',
                      "statements": []
                  }
              },
              {
                  "assignments": [
                      105
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
                  "src": "1061:42:0"
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
                              "referencedDeclaration": 105,
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
                          "referencedDeclaration": 48,
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
                  "src": "1110:16:0"
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
                              "referencedDeclaration": 105,
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
                          "referencedDeclaration": 50,
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
                  "src": "1133:21:0"
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
                              "referencedDeclaration": 105,
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
                          "referencedDeclaration": 52,
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
                  "src": "1161:22:0"
              },
              {
                  "assignments": [
                      131
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
                              "referencedDeclaration": 46,
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
                              "referencedDeclaration": 105,
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
                                  "referencedDeclaration": 20,
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
                          "expression": {
                              "id": '',
                              "name": "verifier",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 7,
                              "src": '',
                              "typeDescriptions": {
                                  "typeIdentifier": "t_contract$_Verifier_Interface_$850",
                                  "typeString": "contract Verifier_Interface"
                              }
                          },
                          "id": '',
                          "isConstant": false,
                          "isLValue": false,
                          "isPure": false,
                          "lValueRequested": false,
                          "memberName": "verify",
                          "nodeType": "MemberAccess",
                          "referencedDeclaration": 849,
                          "src": '',
                          "typeDescriptions": {
                              "typeIdentifier": "t_function_external_nonpayable$_t_array$_t_uint256_$dyn_memory_ptr_$_t_array$_t_uint256_$dyn_memory_ptr_$_t_array$_t_uint256_$dyn_memory_ptr_$returns$_t_bool_$",
                              "typeString": "function (uint256[] memory,uint256[] memory,uint256[] memory) external returns (bool)"
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
                  "src": "1192:48:0"
              },
              {
                  "expression": {
                      "arguments": [
                          {
                              "id": '',
                              "name": "res",
                              "nodeType": "Identifier",
                              "overloadedDeclarations": [],
                              "referencedDeclaration": 131,
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
                  "src": "1247:63:0"
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
                          "referencedDeclaration": 22,
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
                                  "referencedDeclaration": 52,
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
                              "referencedDeclaration": 461,
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
                  "src": "1319:35:0"
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
                              "referencedDeclaration": 15,
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
                              "referencedDeclaration": 22,
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
                          "referencedDeclaration": 22,
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
                  "src": "1361:30:0"
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
          "src": "576:77:0"
      },
      "returnParameters": {
          "id": '',
          "nodeType": "ParameterList",
          "parameters": [],
          "src": "661:0:0"
      },
      "scope": '',
      "src": '',
      "stateMutability": "nonpayable",
      "virtual": false,
      "visibility": "public"
  };
};

export default ShieldContractStatementsBoilerplate;
