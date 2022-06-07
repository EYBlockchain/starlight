/* eslint-disable import/no-cycle */

class ContractBoilerplateGenerator {
  generateBoilerplate(node: any) {
    const { bpSection, bpCategory, ...otherParams } = node;
    return this?.[bpCategory]?.[bpSection]?.(otherParams) ?? [];
  }

  static uniqueify(arr: any[]) {
    return Array.from(new Set(arr));
  }

  contract = {
    importStatements({ newCommitmentsRequired }): string[] {
      return [
        `import "./verify/IVerifier.sol";`,
        ...(newCommitmentsRequired ? [`import "./merkle-tree/MerkleTree.sol";`] : []),
      ];
    },

    stateVariableDeclarations({
      functionNames,
      oldCommitmentAccessRequired,
      nullifiersRequired,
      newCommitmentsRequired,
      containsAccessedOnlyState,
      //isInternalFunctionCall add it
    }): string[] {
      // prettier-ignore
      // Ignoring prettier because it's easier to read this if the strings we're inserting are at the beginning of a line.
      return [
        `
          enum FunctionNames { ${functionNames.join(', ')} }`,

        `
          IVerifier private verifier;`,

        `
          mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames)`,

        ...nullifiersRequired ? [`
          mapping(uint256 => uint256) public nullifiers;`] : [],

        ...(oldCommitmentAccessRequired ? [`
          mapping(uint256 => uint256) public commitmentRoots;`] : []),

        ...(newCommitmentsRequired ? [`
          uint256 public latestRoot;`] : []),

        `
          mapping(address => uint256) public zkpPublicKeys;`, // TODO: consider whether we need to identify when / when not to include this.

        `
          struct Inputs {
            ${[
              ...(nullifiersRequired ? [`uint[] newNullifiers;`] : []),
              ...(containsAccessedOnlyState ? [`uint[] checkNullifiers;`] : []),
              ...(oldCommitmentAccessRequired ? [`uint commitmentRoot;`] : []),
              ...(newCommitmentsRequired ? [`uint[] newCommitments;`] : []),
              `uint[] customInputs;`, // TODO: consider whether we need to identify when / when not to include this.
            ].join('\n\t\t\t\t\t\t')}
          }`,
      ];
    },

    constructor(): string[] {
      // This boilerplate will only be used if the .zol developer didn't write their own constructor. If they already wrote a constructor, we add this boilerplate in the FunctionBoilerplate generator.
      return [
        `
        constructor (
      		address verifierAddress,
      		uint256[][] memory vk
      	) {
      		verifier = IVerifier(verifierAddress);
      		for (uint i = 0; i < vk.length; i++) {
      			vks[i] = vk[i];
      		}
      	}`,
      ];
    },

    registerZKPPublicKey(): string[] {
      return [
        `
        function registerZKPPublicKey(uint256 pk) external {
      		zkpPublicKeys[msg.sender] = pk;
      	}
        `,
      ];
    },

    verify({
      oldCommitmentAccessRequired: commitmentRoot,
      nullifiersRequired: newNullifiers,
      newCommitmentsRequired: newCommitments,
      containsAccessedOnlyState: checkNullifiers,
      circuitParams,
      constructorContainsSecret
    }): string[] {
      const verifyFunctionSignature = `
        function verify(
      		uint256[] ${constructorContainsSecret ? `memory` : `calldata`} proof,
      		uint256 functionId,
      		Inputs memory _inputs
      	) private {
        `;
      let verifyInput: string[] = [];
      const verifyInputsMap = (type: string,input: string, counter: any) => {
        if(type  === 'parameters'){
        switch (input) {
          case 'nullifier':
            verifyInput.push( `
            inputs[k++] = newNullifiers[${counter.newNullifiers++}];`);
            break;
          case 'checkNullifier':
            verifyInput.push(`
            inputs[k++] = checkNullifiers[${counter.checkNullifiers++}];`);
            break;
          case 'newCommitment':
            verifyInput.push(`
            inputs[k++] = newCommitments[${counter.newCommitments++}];`);
            break;
          case 'oldCommitmentExistence':
            verifyInput.push( `
            inputs[k++] = _inputs.commitmentRoot;`);
            break;
          default:
            verifyInput.push( `
            inputs[k++] = customInputs[${counter.customInputs++}];`);
            break;
        }
      }
      else if(type  === 'returnParameters'){
          verifyInput.push( `
          inputs[k++] = ${input};`);
      }
      }
      // prettier-ignore
      // Ignoring prettier because it's easier to read this if the strings we're inserting are at the beginning of a line.
      const verifyPreStatements: string[] = [
        'uint[] memory customInputs = _inputs.customInputs;', // TODO: do we need an indicator for when there are / aren't custom inputs? At the moment they're always assumed:

        ...(newNullifiers ? [`
          uint[] memory newNullifiers = _inputs.newNullifiers;`] : []),

        ...(checkNullifiers ? [`
          uint[] memory checkNullifiers = _inputs.checkNullifiers;`] : []),
        // removed to prevent stack too deep err - converted commitmentRoot to _inputs.commitmentRoot below
        // ...(commitmentRoot ? [`
        //   uint commitmentRoot = _inputs.commitmentRoot;`] : []),

        ...(newCommitments ? [`
          uint[] memory newCommitments = _inputs.newCommitments;`] : []),

        ...(newNullifiers ? [`
          for (uint i; i < newNullifiers.length; i++) {
      			uint n = newNullifiers[i];
      			require(nullifiers[n] == 0, "Nullifier already exists");
      			nullifiers[n] = n;
      		}`] : []),

        ...(checkNullifiers ? [`
          for (uint i; i < checkNullifiers.length; i++) {
            uint n = checkNullifiers[i];
            require(nullifiers[n] == 0, "Nullifier already exists");
          }`] : []),

        ...(commitmentRoot ? [`
          require(commitmentRoots[_inputs.commitmentRoot] == _inputs.commitmentRoot, "Input commitmentRoot does not exist.");`] : []),

          `
            uint256[] memory inputs = new uint256[](${[
            'customInputs.length',
            ...(newNullifiers ? ['newNullifiers.length'] : []),
            ...(checkNullifiers ? ['checkNullifiers.length'] : []),
            ...(commitmentRoot ? ['(newNullifiers.length > 0 ? 1 : 0)'] : []), // newNullifiers and commitmentRoot are always submitted together (regardless of use case). It's just that nullifiers aren't always stored (when merely accessing a state).
            ...(newCommitments ? ['newCommitments.length'] : []),
          ].join(' + ')});`,

      ];
      const verifyInputs: string[] = [];
      for (let [name, _params] of Object.entries(circuitParams)) {
        for (let [type, _inputs] of Object.entries(_params)) {
        const counter = {
          customInputs: 0,
          newNullifiers: 0,
          checkNullifiers: 0,
          newCommitments: 0,
        };

        _inputs.map(i => verifyInputsMap(type, i, counter));

      }

      if(!(Object.keys(_params).includes('returnParameters'))) verifyInput.push(`  \n  \t\t\t\t\t\t \t inputs[k++] = 1;`)

        verifyInputs.push(`
          if (functionId == uint(FunctionNames.${name})) {
            uint k = 0;
            ${verifyInput.join('')}
          }`)
          verifyInput =[];
      }

      const verification: string[] = [
        `
          bool result = verifier.verify(proof, inputs, vks[functionId]);`,

      	`
          require(result, "The proof has not been verified by the contract");`,

        // eslint-disable-next-line no-nested-ternary
        ...((newCommitments && commitmentRoot) ? [`
          if (newCommitments.length > 0) {
      			latestRoot = insertLeaves(newCommitments);
      			commitmentRoots[latestRoot] = latestRoot;
      		}`] :
          newCommitments ? [`
            insertLeaves(newCommitments);`] :
          []
        ),
      ];

      const verify = [
        `${verifyFunctionSignature}
          ${verifyPreStatements.join('\n')}
          ${verifyInputs.join('\n')}
          ${verification.join('\n')}
        }`,
      ];

      return verify;
    },
  };
}

export default ContractBoilerplateGenerator;
