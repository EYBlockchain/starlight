/* eslint-disable import/no-cycle */
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
class ContractBoilerplateGenerator {
    constructor() {
        this.contract = {
            importStatements({ newCommitmentsRequired }) {
                return [
                    `import "./verify/IVerifier.sol";`,
                    ...(newCommitmentsRequired ? [`import "./merkle-tree/MerkleTree.sol";`] : []),
                ];
            },
            stateVariableDeclarations({ functionNames, oldCommitmentAccessRequired, nullifiersRequired, newCommitmentsRequired, containsAccessedOnlyState, }) {
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
          mapping(address => uint256) public zkpPublicKeys;`,
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
            constructor() {
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
            registerZKPPublicKey() {
                return [
                    `
        function registerZKPPublicKey(uint256 pk) external {
      		zkpPublicKeys[msg.sender] = pk;
      	}
        `,
                ];
            },
            verify({ oldCommitmentAccessRequired: commitmentRoot, nullifiersRequired: newNullifiers, newCommitmentsRequired: newCommitments, containsAccessedOnlyState: checkNullifiers, }) {
                const verifyFunctionSignature = `
        function verify(
      		uint256[] calldata proof,
      		uint256 functionId,
      		Inputs memory _inputs
      	) private {
        `;
                // prettier-ignore
                // Ignoring prettier because it's easier to read this if the strings we're inserting are at the beginning of a line.
                const verifyStatements = [
                    'uint[] memory customInputs = _inputs.customInputs;',
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
                        ...(commitmentRoot ? ['(newNullifiers.length > 0 ? 1 : 0)'] : []),
                        ...(newCommitments ? ['newCommitments.length'] : []),
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
          if (newNullifiers.length > 0) inputs[k++] = commitmentRoot;`] : []),
                    ...(newCommitments ? [`
          for (uint i = 0; i < newCommitments.length; i++) {
      			inputs[k++] = newCommitments[i];
      		}`] : []),
                    ...(checkNullifiers ? [`
          for (uint i = 0; i < checkNullifiers.length; i++) {
            inputs[k++] = checkNullifiers[i];
          }`] : []),
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
                            []),
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
    generateBoilerplate(node) {
        var _a, _b, _c;
        const { bpSection, bpCategory } = node, otherParams = __rest(node, ["bpSection", "bpCategory"]);
        return (_c = (_b = (_a = this === null || this === void 0 ? void 0 : this[bpCategory]) === null || _a === void 0 ? void 0 : _a[bpSection]) === null || _b === void 0 ? void 0 : _b.call(_a, otherParams)) !== null && _c !== void 0 ? _c : [];
    }
    static uniqueify(arr) {
        return Array.from(new Set(arr));
    }
}
export default ContractBoilerplateGenerator;
