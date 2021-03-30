export default class Indicator {
  // we might be able to get away with not initialising indicators.
  constructor(scope) {
    this.scope = scope;
    switch (scope.scopeType) {
      case 'ContractDefinition':
        this.indicators = {
          zkSnarkVerificationRequired: false,
          oldCommitmentAccessRequired: false,
          nullifiersRequired: false,
          newCommitmentsRequired: false,
        };
        break;
      case 'FunctionDefinition':
        this.indicators = {
          // BIG COMMENT FOR INFO ONLY
          // id: { // Although state variables have unique names, id is more consistent with other objects
          //   id: state_var_node_id
          //   name: state_var_name,
          //   binding: { binding_of_var_decl },
          //   isReferenced: true,
          //   referenceCount: 3,
          //   referencingPaths: [
          //     path_of_identifier,
          //     path_of_identifier,
          //     ...
          //   ], // we use an array to preserve the order of references
          //   isModified: true,
          //   modificationCount: 1,
          //   modifyingPaths: [
          //     path_of_identifier,
          //     path_of_identifier,
          //     ...
          //   ], // a subset of referencingPaths. // we use an array to preserve the order of references
          //   nullifyingPaths: [
          //     path_of_identifier,
          //     path_of_identifier,
          //     ...
          //   ], // a subset of modifyingPaths. // we use an array to preserve the order of references
          //   oldCommitmentAccessRequired: true,
          //   isNullified: true,
          //   initialisationRequired: true,
          //   newCommitmentRequired: true,
          // }
        };
        break;
      default:
    }
  }

  /**
   * @desc As we traverse through the AST, each node we reach will provide more
   * info to add (as properties) to `this`.
   * @param {NodePath} path
   */
  update(path) {
    const {
      node: { name, id, nodeType },
      parent,
    } = path;

  }

}
