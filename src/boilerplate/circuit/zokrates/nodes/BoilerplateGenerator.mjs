// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.

/** Keep a cache of previously-generated boilerplate, indexed by `indicator` objects (there is 1 indicator object per stateVar, per function). */
const bpCache = new WeakMap();

class BoilerplateGenerator {
  constructor(indicators) {
    if (bpCache.has(indicators)) return bpCache.get(indicators);
    Object.assign(this, indicators); // this inherits all properties of the indicators object.
    this.bpSections.forEach(bpSection => {
      this[bpSection] = [];
    });

    this.generateBoilerplate();

    bpCache.set(indicators, this);
  }

  generateBoilerplateStatement(bpType, extraParams) {
    return {
      nodeType: 'BoilerplateStatement',
      bpSection: 'statements',
      bpType,
      name: this.name,
      // only include if they exist:
      ...(this.isWhole && { isWhole: this.isWhole }),
      ...(this.isPartitioned && { isPartitioned: this.isPartitioned }),
      ...this[bpType](extraParams),
    };
  }

  bpSections = ['importStatements', 'parameters', 'preStatements', 'postStatements'];

  _addBP = (bpType, extraParams) => {
    this.bpSections.forEach(bpSection => {
      this[bpSection] = this[bpSection]
        .concat({
          nodeType: 'Boilerplate',
          bpSection,
          bpType,
          name: extraParams.name || this.name,
          // only include if they exist:
          ...(this.isWhole && { isWhole: this.isWhole }),
          ...(this.isPartitioned && { isPartitioned: this.isPartitioned }),
          ...this[bpType](extraParams),
        })
        .filter(Boolean);
    });
  };

  addBP = {
    // TODO: is `this` that of the class instance, or that of `addBP`, here?
    partitioned(bpType, extraParams = {}) {
      const { increments, decrements, name } = this;
      increments.forEach((addend, i) =>
        this._addBP(bpType, { name: `${name}_${i}`, ...extraParams }),
      );
      const startIndex = increments.length;
      decrements.forEach((subtrahend, i) => {
        const j = startIndex + i;
        if (
          ['PoKoSK', 'nullification', 'oldCommitmentPreimage', 'oldCommitmentExistence'].includes(
            bpType,
          )
        ) {
          this._addBP(bpType, { name: `${name}_${j}`, ...extraParams });
          this._addBP(bpType, { name: `${name}_${j + 1}`, ...extraParams });
        }
        if (bpType === 'newCommitment') {
          this._addBP(bpType, { name: `${name}_${j + 2}`, ...extraParams });
          this._addBP(bpType, { name: `${name}_${j + 3}`, ...extraParams });
        }
      });
    },

    whole: this._addBP,
  };

  generateBoilerplate() {
    const addBP = (this.isWhole ? this.addBP.whole : this.addBP.partitioned).bind(this); // the class will be 'this' within the function.
    if (this.isNullified || this.isAccessed) {
      addBP('PoKoSK');
      addBP('nullification');
      addBP('oldCommitmentPreimage');
      addBP('oldCommitmentExistence');
    }
    if (this.newCommitmentRequired) {
      addBP('newCommitment');
    }
    if (this.isMapping) {
      for (const mappingKey of Object.keys(this.mappingKey)) {
        addBP('mapping', { mappingName: this.x, mappingKey });
      }
    }
  }

  /**
   * A partitioned state can only be incremented or decremented.
   * New 'part' commitments get created when incrementing.
   * 'Part' commitments get nullified & created when decrementing.
   * If there are multiple incs/decs in a function, then we need to keep track
   * of all the 'parts' with indexes.
   */
  // TODO: tidy this up...
  getIndex({ addendId, subtrahendId }) {
    if (addendId && subtrahendId)
      throw new Error('Expected only one of addend xor subtrahend; got both.');
    const { increments, decrements } = this;
    const notFoundErr = new Error('Not found in array.');

    let index;

    if (addendId) {
      index = increments.findIndex(node => addendId === node.id);
      if (index === -1) throw notFoundErr;
    } else if (subtrahendId) {
      index = decrements.findIndex(node => subtrahendId === node.id);
      if (index === -1) throw notFoundErr;
      const indicesPerDecrementation = 4;
      const startIndex = increments.length;
      index = startIndex + index * indicesPerDecrementation;
    } else {
      throw new Error('This should be unreachable.');
    }

    return index;
  }

  PoKoSK = () => ({});

  nullification = () => ({});

  oldCommitmentPreimage = () => ({});

  oldCommitmentExistence = () => ({});

  newCommitment = () => ({});

  mapping = ({ mappingName, mappingKeyName }) => ({
    mappingName,
    mappingKeyName,
  });

  /** Partitioned states need boilerplate for an incrementation/decrementation, because it's so weird and different from `a = a - b`. Whole states inherit directly from the AST, so don't need boilerplate here. */
  // TODO: Code for incrementation & decrementation might be able to be merged, given they're very similar.
  incrementation = ({ addendId }) => {
    const startIndex = this.getIndex({ addendId });
    return {
      startIndex,
      addend: {},
    };
  };

  decrementation = ({ subtrahendId }) => {
    const startIndex = this.getIndex({ subtrahendId });
    return {
      startIndex,
      subtrahend: {},
    };
  };
}

export default BoilerplateGenerator;
