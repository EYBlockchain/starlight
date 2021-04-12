/* eslint-disable max-classes-per-file */

import NodePath from './NodePath.mjs';

export class ContractDefinitionIndicator {
  constructor() {
    this.zkSnarkVerificationRequired = false;
    this.oldCommitmentAccessRequired = false;
    this.nullifiersRequired = false;
    this.newCommitmentsRequired = false;
  }

  // A ContractDefinitionIndicator will be updated if (some time after its creation) we encounter an AST node which gives us more information about the contract's global states
  // E.g. if we encounter a VariableDeclaration node for a secret state.
  update(path) {
    if (path.node.isSecret) {
      // These Indicator properties are used to construct import statements & boilerplate for the shield contract AST:
      this.newCommitmentsRequired = true;
      this.zkSnarkVerificationRequired = true;
    }
  }
}

export class FunctionDefinitionIndicator {
  // no constructor yet...
  //
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
}

/**
 * Within a Function's scope, for each state variable that gets mentioned, we
 * create a 'StateVariableIndicator'.
 */
export class StateVariableIndicator {
  /** @param {NodePath} path the path of the stateVariable for which we're creating an indicator
   */
  constructor(path) {
    const referencedBinding = path.getReferencedBinding();
    const referencedId = referencedBinding.id;
    const referencedName = referencedBinding.name;

    this.id = referencedId;
    this.name = referencedName;
    this.binding = referencedBinding;

    this.isSecret = referencedBinding.isSecret; // only included to match bindings so that mappingKey class can be reused for both. Consider removing if things get too messy, and splitting mappingKey into two classes; one for Binding & one for StateVarIndicator

    this.referenceCount = 0;
    this.referencingPaths = [];

    this.modificationCount = 0;
    this.modifyingPaths = [];

    if (path.isMappingIdentifier()) {
      this.isMapping = true;
      this.mappingKeys = {};
    }
  }

  // TODO / FIXME - THIS FUNCTION IS CURRENTLY JUST A COPY-PASTE FROM THE BINDING CLASS!
  // If this binding represents a mapping stateVar, then throughout the code, this mapping will be accessed with different keys. Only when we reach that key during traversal can we update this binding to say "this mapping sometimes gets accessed via this particular key"
  addMappingKey(referencingPath) {
    const keyNode =
      referencingPath.parent.indexExpression.expression ||
      referencingPath.parent.indexExpression; // FIXME: the keyNode should always be parent.indexExpression. The reason for the complication is to get 'Msg' for msg.sender, but it'd be better (and make it easier to expand to other struct (MemberAccess) keys in future) if we always use parent.indexExpression. In the case of msg.sender, the keyname would become msg.sender. At the moment, making that change causes the increments stuff to break. :(
    const keyPath = NodePath.getPath(keyNode);
    if (!keyPath) throw new Error('No keyPath found in pathCache');

    if (keyNode.nodeType !== 'Identifier') {
      throw new Error(
        `A mapping key of nodeType '${keyNode.nodeType}' isn't supported yet. We've only written the code for keys of nodeType Identifier'`,
      );
    }

    // naming of the key within mappingKeys:
    let keyName = keyNode.name;
    const keyBinding = keyPath.getReferencedBinding();
    if (keyBinding?.isModified)
      keyName = `${keyName}_${keyBinding.modificationCount}`;

    // add this mappingKey if it hasn't yet been added:
    const mappingKeyExists = !!this.mappingKeys[keyName];
    if (!mappingKeyExists)
      this.mappingKeys[keyName] = new MappingKey(this, keyPath);

    return this.mappingKeys[keyName];
  }

  // A StateVariableIndicator will be updated if (some time after its creation) we encounter an AST node which refers to this state variable.
  // E.g. if we encounter an Identifier node.
  update(path) {
    if (this.isMapping) {
      this.addMappingKey(path).updateProperties(path);
    } else {
      this.updateProperties(path);
    }
  }

  updateProperties(path) {
    this.addReferencingPath(path);
    if (path.isModification()) {
      this.addModifyingPath(path);
    }
  }

  updateIncrementation(path, state) {
    if (!path.isIncremented) {
      this.isWhole = true;
      const reason = { src: state.incrementedIdentifier.src, 0: `Overwritten` };
      this.isWholeReason ??= [];
      this.isWholeReason.push(reason);
    }
    // if its incremented anywhere, isIncremented = true
    // so we only assign if it's already falsey
    this.isIncremented ||= path.isIncremented;
    this.isDecremented ||= path.isDecremented;
    this.increments ??= [];
    this.decrements ??= [];
    state.increments.forEach(inc => {
      this.increments.push(inc);
      if (this.isMapping) {
        const mappingKey = this.mappingKeys[
          path.scope.getMappingKeyName(state.incrementedIdentifier)
        ];
        mappingKey.increments ??= [];
        mappingKey.increments.push(inc);
      }
    });
    state.decrements.forEach(dec => {
      this.decrements.push(dec);
      if (this.isMapping) {
        const mappingKey = this.mappingKeys[
          path.scope.getMappingKeyName(state.incrementedIdentifier)
        ];
        mappingKey.decrements ??= [];
        mappingKey.decrements.push(dec);
      }
    });
  }

  addReferencingPath(path) {
    this.isReferenced = true;
    ++this.referenceCount;
    if (!this.referencingPaths.some(p => p.node.id === path.node.id))
      this.referencingPaths.push(path);
  }

  addModifyingPath(path) {
    this.isModified = true;
    ++this.modificationCount;
    if (!this.modifyingPaths.some(p => p.node.id === path.node.id)) {
      this.modifyingPaths.push(path);

      this.newCommitmentRequired = true;
      this.initialisationRequired = true; // Used? Probably for whole states?

      const { node } = path;
      if (node.isKnown) this.isKnown = true;
      if (node.isUnknown) this.isUnknown = true;
    }
  }

  addNullifyingPath(path) {
    this.isNullified = true;
    ++this.nullificationCount;
    this.nullifyingPaths.push(path);
  }
}

/**
 * If a Binding/StateVarIndicator represents a mapping, it will contain a MappingKey class.
 */
export class MappingKey {
  /**
   * A mappingKey can be contained within a binding or an indicator class.
   * @param { Binding || StateVarIndicator } container
   * @param { NodePath } keyPath
   */
  constructor(container, keyPath) {
    this.container = container;

    // TODO: distinguish between if the key is a reference and if the key is not a reference - the prefix 'referenced' is misleading below:
    this.referencedKeyId = keyPath.node.referencedDeclaration;
    this.referencedKeyNodeType = keyPath.isMsg()
      ? 'msg.sender'
      : keyPath.getReferencedNode().nodeType;
    this.referencedKeyIsParam = keyPath.isFunctionParameter(); // is a function parameter - used for finding owner
    this.isMsgSender = keyPath.isMsg(); // used for finding owner
    this.isSecret = container.isSecret; // only really used by binding.

    this.isReferenced = false;
    this.referenceCount = 0;
    this.referencingPaths = []; // paths which reference this variable

    this.isModified = false;
    this.modificationCount = 0;
    this.modifyingPaths = []; // paths which reference this variable
  }

  updateProperties(path) {
    this.addReferencingPath(path);
    if (path.isModification()) this.addModifyingPath(path);

    this.container.updateProperties(path);
  }

  // TODO: move into commonFunctions (because it's the same function as included in the Binding class)
  addReferencingPath(path) {
    this.isReferenced = true;
    ++this.referenceCount;
    if (!this.referencingPaths.some(p => p.node.id === path.node.id))
      this.referencingPaths.push(path);
  }

  addModifyingPath(path) {
    this.isModified = true;
    ++this.modificationCount;
    if (!this.modifyingPaths.some(p => p.node.id === path.node.id)) {
      this.modifyingPaths.push(path);

      this.newCommitmentRequired = true;
      this.initialisationRequired = true; // Used? Probably for whole states?

      const { node } = path;
      if (node.isKnown) this.isKnown = true;
      if (node.isUnknown) this.isUnknown = true;
    }
  }
}
