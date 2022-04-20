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
    }): string[] {
      const verifyFunctionSignature = `
        function verify(
      		uint256[] calldata proof,
      		uint256 functionId,
      		Inputs memory _inputs
      	) private {
        `;

      // prettier-ignore
      // Ignoring prettier because it's easier to read this if the strings we're inserting are at the beginning of a line.
      const verifyStatements: string[] = [
        'uint[] memory customInputs = _inputs.customInputs;', // TODO: do we need an indicator for when there are / aren't custom inputs? At the moment they're always assumed:

        ...(newNullifiers ? [`
          uint[] memory newNullifiers = _inputs.newNullifiers;`] : []),

        ...(checkNullifiers ? [`
          uint[] memory checkNullifiers = _inputs.checkNullifiers;`] : []),

        ...(commitmentRoot ? [`
          uint commitmentRoot = _inputs.commitmentRoot;`] : []),

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
          require(commitmentRoots[commitmentRoot] == commitmentRoot, "Input commitmentRoot does not exist.");`] : []),

        `
          uint256[] memory inputs = new uint256[](${[
          'customInputs.length',
          ...(newNullifiers ? ['newNullifiers.length'] : []),
          ...(checkNullifiers ? ['checkNullifiers.length'] : []),
          ...(commitmentRoot ? ['(newNullifiers.length > 0 ? 1 : 0)'] : []), // newNullifiers and commitmentRoot are always submitted together (regardless of use case). It's just that nullifiers aren't always stored (when merely accessing a state).
          ...(newCommitments ? ['newCommitments.length + 1'] : []),
        ].join(' + ')});`,

        `
          uint k = 0;`,

        `
          for (uint i = 0; i < customInputs.length; i++) {
    			  inputs[k++] = customInputs[i];
    		  }`,

        ...(newNullifiers ?
          [`
          for (uint i = 0; i < newNullifiers.length; i++) {
    			  inputs[k++] = newNullifiers[i];
    		  }`] : []),

        ...(commitmentRoot ? [`
          if (newNullifiers.length > 0) inputs[k++] = commitmentRoot;`] : []), // assumes nullifiers always get submitted with commitmentRoot (and vice versa)

        ...(newCommitments ? [`
          for (uint i = 0; i < newCommitments.length; i++) {
      			inputs[k++] = newCommitments[i];
      		}`] : []),

        ...(checkNullifiers ? [`
          for (uint i = 0; i < checkNullifiers.length; i++) {
            inputs[k++] = checkNullifiers[i];
          }`] : []),

        `
          inputs[k++] = 1;

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
          ${verifyStatements.join('\n')}
        }`,
      ];

      return verify;
    },
  };
}

export default ContractBoilerplateGenerator;
