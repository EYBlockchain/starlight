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
class FunctionBoilerplateGenerator {
    constructor() {
        // 'constructor' is a reserved keyword in JS
        this.cnstrctr = {
            parameters() {
                return [
                    `address verifierAddress`,
                    `uint256[][] memory vk`,
                ];
            },
            postStatements() {
                return [
                    `verifier = IVerifier(verifierAddress);
    		  for (uint i = 0; i < vk.length; i++) {
    			  vks[i] = vk[i];
    		  }`,
                ];
            },
        };
        this.customFunction = {
            parameters({ nullifiersRequired: newNullifiers, oldCommitmentAccessRequired: commitmentRoot, newCommitmentsRequired: newCommitments, containsAccessedOnlyState: checkNullifiers, }) {
                return [
                    ...(newNullifiers ? [`uint256[] calldata newNullifiers`] : []),
                    ...(commitmentRoot ? [`uint256 commitmentRoot`] : []),
                    ...(newCommitments ? [`uint256[] calldata newCommitments`] : []),
                    ...(checkNullifiers ? [`uint256[] calldata checkNullifiers`] : []),
                    `uint256[] calldata proof`,
                ];
            },
            // @param {Array} customInputs
            postStatements({ functionName, customInputs, // array of custom input names
            nullifiersRequired: newNullifiers, oldCommitmentAccessRequired: commitmentRoot, newCommitmentsRequired: newCommitments, containsAccessedOnlyState: checkNullifiers, }) {
                // prettier-ignore
                return [
                    `
          Inputs memory inputs;`,
                    ...((customInputs === null || customInputs === void 0 ? void 0 : customInputs.length) ?
                        [`
          inputs.customInputs = new uint[](${customInputs.length});
        	${customInputs.map((name, i) => {
                                if (customInputs[i] === 'msgSender')
                                    return `inputs.customInputs[${i}] = uint256(uint160(address(msg.sender)));`;
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
    generateBoilerplate(node) {
        var _a, _b, _c;
        const { bpSection, bpCategory } = node, otherParams = __rest(node, ["bpSection", "bpCategory"]);
        return (_c = (_b = (_a = this === null || this === void 0 ? void 0 : this[bpCategory]) === null || _a === void 0 ? void 0 : _a[bpSection]) === null || _b === void 0 ? void 0 : _b.call(_a, otherParams)) !== null && _c !== void 0 ? _c : [];
    }
    static uniqueify(arr) {
        return Array.from(new Set(arr));
    }
}
export default FunctionBoilerplateGenerator;
