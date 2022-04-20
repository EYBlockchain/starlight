// Q: how are we merging mapping key and ownerPK in edge case?
// Q: should we reduce constraints a mapping's commitment's preimage by not having the extra inner hash? Not at the moment, because it adds complexity to transpilation.


// collects increments and decrements into a string (for new commitment calculation) and array
// (for collecting zokrates inputs
import { StateVariableIndicator } from '../../../../traverse/Indicator.js';
import MappingKey from '../../../../traverse/MappingKey.js';

const collectIncrements = (stateVarIndicator: BoilerplateGenerator) => {
  const incrementsArray = [];
  let incrementsString = '';
  // TODO sometimes decrements are added to .increments
  // current fix -  prevent duplicates
  for (const inc of stateVarIndicator.increments) {
    if (!inc.name) inc.name = inc.value;

    if (incrementsArray.some(existingInc => inc.name === existingInc.name))
      continue;
    incrementsArray.push({
      name: inc.name,
      precedingOperator: inc.precedingOperator,
    });

    if (inc === stateVarIndicator.increments[0]) {
      incrementsString += `${inc.name}`;
    } else {
      incrementsString += ` ${inc.precedingOperator} ${inc.name}`;
    }
  }
  for (const dec of stateVarIndicator.decrements) {
    if (!dec.name) dec.name = dec.value;
    if (incrementsArray.some(existingInc => dec.name === existingInc.name))
      continue;
    incrementsArray.push({
      name: dec.name,
      precedingOperator: dec.precedingOperator,
    });

    if (!stateVarIndicator.decrements[1] && !stateVarIndicator.increments[0]) {
      incrementsString += `${dec.name}`;
    } else {
      // if we have decrements, this str represents the value we must take away
      // => it's a positive value with +'s
      incrementsString += ` + ${dec.name}`;
    }
  }
  return { incrementsArray, incrementsString };
};

/** Keep a cache of previously-generated boilerplate, indexed by `indicator` objects (there is 1 indicator object per stateVar, per function). */
const bpCache = new WeakMap();

class BoilerplateGenerator {
  id: number;
  name: string;
  isWhole?: boolean;
  isPartitioned?: boolean;
  isNullified?: boolean;
  isAccessed?: boolean;
  newCommitmentsRequired?: boolean;
  isMapping: boolean;
  increments: any;
  decrements: any;
  burnedOnly: any;
  mappingKeyName: string;
  mappingName: string;
  indicators: any;
  newCommitmentValue: any;
  bpSections: string[] = ['importStatements', 'parameters', 'preStatements', 'postStatements'];

  constructor(indicators: StateVariableIndicator) {

    // Through prior traversals, a BoilerplateGenerator class for this set of indicators might already be stored in memory:
    if (bpCache.has(indicators)) return bpCache.get(indicators);

    // Initialise bpSections - we'll then only push boilerplate to certain sections if this class's indicators contain certain booleans (see generateBoilerplate()).
    this.bpSections.forEach(bpSection => {
      this[bpSection] = [];
    });

    this.initialise(indicators);

    bpCache.set({indicators}, this);
  }
  // Bump all important indicators (used by this class) to this 'top-level' of `this`.
  assignIndicators(indicators: StateVariableIndicator | MappingKey ) {
    const {
      id,
      name,
      isWhole,
      isPartitioned,
      isNullified,
      isAccessed,
      newCommitmentsRequired,
      isMapping,
      increments,
      decrements,
      // burnedOnly,
    } = indicators;
    Object.assign(this, {
      id,
      name,
      isWhole,
      isPartitioned,
      isNullified,
      isAccessed,
      newCommitmentsRequired,
      isMapping,
      increments,
      decrements,
      // burnedOnly,
    });
  }

  initialise(indicators: StateVariableIndicator){
    this.indicators = indicators;
    if (indicators.isMapping) {
      for (const [mappingKeyName, mappingKeyIndicator] of Object.entries(indicators.mappingKeys)) {
        mappingKeyIndicator.isMapping = true; // TODO: put isMapping in every mappingKeys indicator during prelim traversals
        this.assignIndicators(mappingKeyIndicator);
        this.mappingKeyName = mappingKeyName;
        this.mappingName = this.indicators.name;
        this.name = `${this.mappingName}_${mappingKeyName}`;
        this.generateBoilerplate();
      }
    } else {
      this.assignIndicators(indicators);
      this.generateBoilerplate();
    }
  }

  refresh(mappingKeyName: string) {
    const mappingKeyIndicator = this.indicators.mappingKeys[mappingKeyName];
    this.assignIndicators(mappingKeyIndicator);
    this.mappingKeyName = mappingKeyName;
    this.mappingName = this.indicators.name;
    this.name = `${this.mappingName}_${mappingKeyName}`;
  }

  generateBoilerplateStatement(bpType: string, extraParams?: any) {
    if (this.isMapping) {
      // Depending on the mapping key being used in the current statement being considered by the compiler, there will be different indicators. We'll need to 'refresh' the indicators that this class is looking at, each time we encounter a new statement.
      const { mappingKeyName } = extraParams;
      this.refresh(mappingKeyName);
    }

    return {
      nodeType: 'BoilerplateStatement',
      bpSection: 'statements',
      bpType,
      name: this.name,
      id: this.id,
      // only include if they exist:
      ...(this.isWhole && { isWhole: this.isWhole }),
      ...(this.isPartitioned && { isPartitioned: this.isPartitioned }),
      ...(this.isMapping && { isMapping: this.isMapping }),
      ...this[bpType](extraParams),
    };
  }

  _addBP = (bpType: string, extraParams?: any) => {

    if (this.isPartitioned) {
      this.newCommitmentValue = collectIncrements(this).incrementsString;
    }
    this.bpSections.forEach(bpSection => {
      this[bpSection] = this[bpSection]
        .concat({
          nodeType: 'Boilerplate',
          bpSection,
          bpType,
          name: extraParams?.name || this.name,
          id: this.id,
          // only include if they exist:
          ...(this.isWhole && { isWhole: this.isWhole }),
          ...(this.isPartitioned && { isPartitioned: this.isPartitioned }),
          ...(this.isNullified && { isNullified: this.isNullified }),
          ...(this.isMapping && { isMapping: this.isMapping }),
          ...(this.isAccessed && { isAccessed: this.isAccessed }),
          ...(this.newCommitmentValue && { newCommitmentValue: this.newCommitmentValue }),
          // ...(this.burnedOnly && { burnedOnly: this.burnedOnly }), // TODO
          ...this[bpType](extraParams),
        })
        .filter(Boolean);
    });
  };

  addBP = {
    partitioned(bpType: string, extraParams?: any) {
      const { name } = this;
      const j = 0;
      if (
        [
          'PoKoSK',
          'nullification',
          'oldCommitmentPreimage',
          'oldCommitmentExistence',
          'mapping',
        ].includes(bpType)
      ) {
        this._addBP(bpType, { name: `${name}_${j}`, ...extraParams });
        this._addBP(bpType, { name: `${name}_${j + 1}`, ...extraParams });
      }
      if (this.isNullified && ['newCommitment', 'mapping'].includes(bpType)) {
        this._addBP(bpType, { name: `${name}_${j + 2}`, ...extraParams });
      } else if (['newCommitment', 'mapping'].includes(bpType)) {
        this._addBP(bpType, { name: `${name}_${j}`, ...extraParams });
      }
    },

    whole: this._addBP,
  };

  generateBoilerplate() {
    const addBP = (this.isWhole ? this.addBP.whole : this.addBP.partitioned).bind(this); // the class will be 'this' within the function.
    if (this.isMapping) {
      addBP('mapping');
    }
    if (this.isNullified || this.isAccessed) {
      addBP('PoKoSK');
      addBP('nullification');
      addBP('oldCommitmentPreimage');
      addBP('oldCommitmentExistence');
    }
    if (this.newCommitmentsRequired && !this.burnedOnly) {
      addBP('newCommitment');
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
  getIndex({ addendId, subtrahendId }): number | null {
    if (addendId && subtrahendId)
      throw new Error('Expected only one of addend xor subtrahend; got both.');
    const { increments, decrements } = this;
    const notFoundErr = new Error('Not found in array.');

    let index: number;

    if (addendId) {
      index = increments.findIndex((node: any) => addendId === node.id);
      if (index === -1) throw notFoundErr;
    } else if (subtrahendId) {
      index = decrements.findIndex((node: any) => subtrahendId === node.id);
      if (index === -1) throw notFoundErr;
      const indicesPerDecrementation = 4;
      const startIndex = increments?.length || 0;
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

  mapping = () => ({
    mappingName: this.mappingName,
    mappingKeyName: this.mappingKeyName,
  });

  /** Partitioned states need boilerplate for an incrementation/decrementation, because it's so weird and different from `a = a - b`. Whole states inherit directly from the AST, so don't need boilerplate here. */
  incrementation = () => {
    //const startIndex = this.getIndex({ addendId });
    return {
      // startIndex,
      addend: {},
    };
  };

  decrementation = () => {
    //const startIndex = this.getIndex({ subtrahendId });
    return {
      // startIndex,
      subtrahend: {},
    };
  };
}

export default BoilerplateGenerator;
