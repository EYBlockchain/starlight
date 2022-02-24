/* eslint-disable import/no-cycle */

import codeGenerator from '../../../../codeGenerators/contract/solidity/toContract.js';

class FunctionBoilerplateGenerator {
  generateBoilerplate(node: any) {
    const { bpSection, bpCategory, ...otherParams } = node;
    return this?.[bpCategory]?.[bpSection]?.(otherParams) ?? [];
  }

  static uniqueify(arr: any) {
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

    postStatements(): string[] {
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
      newCommitmentRequired: newCommitments,
      containsAccessedOnlyState: checkNullifiers,
    }): string[] {
      return [
        ...(newNullifiers ? [`uint256[] calldata newNullifiers`] : []),
        ...(commitmentRoot ? [`uint256 commitmentRoot`] : []),
        ...(newCommitments ? [`uint256[] calldata newCommitments`] : []),
        ...(checkNullifiers ? [`uint256[] calldata checkNullifiers`] : []),
        `uint256[] calldata proof`,
      ];
    },

    // @param {Array} customInputs
    postStatements({
      functionName,
      customInputs, // array of custom input names
      nullifiersRequired: newNullifiers,
      oldCommitmentAccessRequired: commitmentRoot,
      newCommitmentRequired: newCommitments,
      containsAccessedOnlyState: checkNullifiers,
    }): string[] {
      // prettier-ignore
      return [
        `
          Inputs memory inputs;`,

        ...(customInputs?.length ?
          [`
          inputs.customInputs = new uint[](${customInputs.length});
        	${customInputs.map((name: string, i: number) => {
            if (customInputs[i] === 'msgSender') return `inputs.customInputs[${i}] = uint256(uint160(address(msg.sender)));`
            return `inputs.customInputs[${i}] = ${name};`;
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
          verify(proof, uint(FunctionNames.${functionName}), inputs);`,
      ];
    },
  };
}

export default FunctionBoilerplateGenerator;
