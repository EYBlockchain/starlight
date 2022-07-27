/* eslint-disable import/no-cycle */

class FunctionBoilerplateGenerator {
  generateBoilerplate(node: any) {
    const { bpSection, bpCategory, ...otherParams } = node;
    return this?.[bpCategory]?.[bpSection]?.(otherParams) ?? [];
  }

  static uniqueify(arr: any[]) {
    return Array.from(new Set(arr));
  }

  // 'constructor' is a reserved keyword in JS
  cnstrctr = {
    parameters(): string[] {
      return [
        `address verifierAddress`, //
        `uint256[][] memory vk`,
      ];
    },

    preStatements(): string[] {
      return [
        `verifier = IVerifier(verifierAddress);
    		  for (uint i = 0; i < vk.length; i++) {
    			  vks[i] = vk[i];
    		  }`,
      ];
    },

  };

  customFunction = {
    parameters({
      nullifiersRequired: newNullifiers,
      oldCommitmentAccessRequired: commitmentRoot,
      newCommitmentsRequired: newCommitments,
      containsAccessedOnlyState: checkNullifiers,
      isConstructor
    }): string[] {
      const visibility = isConstructor ? 'memory' : 'calldata';
      return [
        ...(newNullifiers ? [`uint256[] ${visibility} newNullifiers`] : []),
        ...(commitmentRoot ? [`uint256 commitmentRoot`] : []),
        ...(newCommitments ? [`uint256[] ${visibility} newCommitments`] : []),
        ...(checkNullifiers ? [`uint256[] ${visibility} checkNullifiers`] : []),
        ...(newCommitments || newNullifiers ? [`uint256[] ${visibility} proof`] : []),
      ];
    },

    // @param {Array} customInputs
    postStatements({
      functionName,
      customInputs, // array of custom input names
      nullifiersRequired: newNullifiers,
      oldCommitmentAccessRequired: commitmentRoot,
      newCommitmentsRequired: newCommitments,
      containsAccessedOnlyState: checkNullifiers,
      isConstructor
    }): string[] {
      // prettier-ignore
      let parameter = [
      ...(customInputs ? customInputs.filter(input => !input.dummy).map(input => input.structName ? `(${input.properties.map(p => p.type)})` : input.type) : []),
      ...(newNullifiers ? [`uint256[]`] : []),
      ...(commitmentRoot ? [`uint256`] : []),
      ...(newCommitments ? [`uint256[]`] : []),
      ...(checkNullifiers ? [`uint256[]`] : []),
      `uint256[]`,
    ];

      customInputs?.forEach((input, i) => {
        if (input.structName) customInputs[i] = input.properties;
      });

      let msgSigCheck = ([...(isConstructor ? [] : [`bytes4 sig = bytes4(keccak256("${functionName}(${parameter})")) ;  \n \t \t \t if (sig == msg.sig)`])]);

      return [
        `
          Inputs memory inputs;`,

        ...(customInputs?.length ?
          [`
          inputs.customInputs = new uint[](${customInputs.flat(Infinity).length});
        	${customInputs.flat(Infinity).map((input: any, i: number) => {
            if (input.type === 'address') return `inputs.customInputs[${i}] = uint256(uint160(address(${input.name})));`;
            if (input.type === 'bool') return `inputs.customInputs[${i}] = ${input.name} == false ? 0 : 1;`;
            return `inputs.customInputs[${i}] = ${input.name};`;
          }).join('\n')}`]
          : []),

        ...(newNullifiers ? [`
          inputs.newNullifiers = newNullifiers;`] : []),

        ...(checkNullifiers ? [`
          inputs.checkNullifiers = checkNullifiers;`] : []),

        ...(commitmentRoot ? [`
          inputs.commitmentRoot = commitmentRoot;`] : []),

        ...(newCommitments ? [`
          inputs.newCommitments = newCommitments;`] : []),
        `
          ${msgSigCheck.join('\n')}`,
        `
          verify(proof, uint(FunctionNames.${functionName}), inputs);`,
      ];
    },
  };


}

export default FunctionBoilerplateGenerator;
