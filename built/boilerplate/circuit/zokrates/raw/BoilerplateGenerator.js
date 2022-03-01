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
class BoilerplateGenerator {
    constructor() {
        this.PoKoSK = {
            importStatements() {
                return [`from "./common/hashes/sha256/pad256ThenHash.zok" import main as sha256of256`];
            },
            parameters({ name: x }) {
                return [`private u32[8] ${x}_oldCommitment_owner_secretKey`];
            },
            postStatements({ name: x }) {
                // default nullification lines (for partitioned & whole states)
                return [
                    `
        // ${x}_oldCommitment - PoKoSK:
        // The correctness of this secret key will be constrained within the oldCommitment existence check.

        u32[8] ${x}_oldCommitment_owner_publicKey = sha256of256([...${x}_oldCommitment_owner_secretKey])`,
                ];
            },
        };
        this.nullification = {
            importStatements() {
                return [
                    `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
                    `from "utils/casts/u32_8_to_bool_256.zok" import main as u32_8_to_bool_256`,
                    `from "./common/hashes/sha256/pad768ThenHash.zok" import main as sha256of768`,
                ];
            },
            parameters({ name: x }) {
                return [
                    `private u32[8] ${x}_oldCommitment_owner_secretKey`,
                    `public field ${x}_oldCommitment_nullifier`,
                ];
            },
            preStatements({ name: x, id, isMapping }) {
                if (isMapping)
                    return [];
                return [
                    `
        // We need to hard-code each stateVarId into the circuit:
        u32[8] ${x}_stateVarId = field_to_u32_8(${id})`, // TODO: this results in unnecessary unpacking constraints, but simplifies transpilation effort, for now.
                ];
            },
            postStatements({ name: x }) {
                // default nullification lines (for partitioned & whole states)
                const lines = [
                    `
        // Nullify ${x}:

        u32[8] ${x}_oldCommitment_nullifier_check = sha256of768([\\
          ...${x}_stateVarId,\\
          ...${x}_oldCommitment_owner_secretKey,\\
          ...${x}_oldCommitment_salt\\
        ])

        assert(\\
        field_to_bool_256(${x}_oldCommitment_nullifier)[8..256] == u32_8_to_bool_256(${x}_oldCommitment_nullifier_check)[8..256]\\
        )`,
                ];
                if (this.isWhole && !(this.isAccessed && !this.isNullified)) {
                    // whole states also need to handle the case of a dummy nullifier
                    const newLines = [
                        `
          ${x}_oldCommitment_owner_secretKey = if ${x}_oldCommitment_isDummy then [0x00000000; 8] else ${x}_oldCommitment_owner_secretKey fi

          ${x}_oldCommitment_salt = if ${x}_oldCommitment_isDummy then [0x00000000; 8] else ${x}_oldCommitment_salt fi`,
                    ];
                    newLines.concat(lines);
                }
                return lines;
            },
        };
        this.oldCommitmentPreimage = {
            importStatements() {
                return [
                    `from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024`,
                    `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
                ];
            },
            parameters({ name: x }) {
                // prettier-ignore
                return [
                    `private field ${x}_oldCommitment_value`,
                    `private u32[8] ${x}_oldCommitment_salt`,
                ];
            },
            preStatements({ name: x }) {
                // For a state variable, we'll have passed in `${x}_oldCommitment_value` as a parameter. But our AST nodes will be using `${x}`. This line resolves the two.
                return [
                    `
        field ${x} = ${x}_oldCommitment_value`,
                ];
            },
            postStatements({ name: x }) {
                return [
                    `
        // ${x}_oldCommitment_commitment: preimage check

        u32[8] ${x}_oldCommitment_commitment = sha256of1024([\\
          ...${x}_stateVarId,\\
          ...field_to_u32_8(${x}_oldCommitment_value),\\
          ...${x}_oldCommitment_owner_publicKey,\\
          ...${x}_oldCommitment_salt\\
        ])`,
                ];
            },
        };
        this.oldCommitmentExistence = {
            importStatements() {
                return [
                    `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
                    `from "utils/pack/bool/pack256.zok" import main as bool_256_to_field`,
                    `from "utils/casts/u32_8_to_bool_256.zok" import main as u32_8_to_bool_256`,
                    `from "./common/merkle-tree/mimc/altbn254/verify-membership/height32.zok" import main as checkRoot`,
                ];
            },
            parameters({ name: x, isWhole, isAccessed, isNullified }) {
                const lines = [
                    `public field commitmentRoot`,
                    `private field ${x}_oldCommitment_membershipWitness_index`,
                    `private field[32] ${x}_oldCommitment_membershipWitness_siblingPath`,
                ];
                if (isWhole && !(isAccessed && !isNullified)) {
                    lines.unshift(`private bool ${x}_oldCommitment_isDummy`);
                }
                return lines;
            },
            postStatements({ name: x, isWhole, isAccessed, isNullified }) {
                const lines = [
                    `
        // ${x}_oldCommitment_commitment: existence check

        field ${x}_oldCommitment_commitment_truncated = bool_256_to_field([...[false; 8], ...u32_8_to_bool_256(${x}_oldCommitment_commitment)[8..256]])`,
                    `
        field ${x}_commitmentRoot_check = checkRoot(\\
          ${x}_oldCommitment_membershipWitness_siblingPath,\\
          ${x}_oldCommitment_commitment_truncated,\\
          ${x}_oldCommitment_membershipWitness_index\\
        )`,
                    `
        assert(\\
          field_to_bool_256(commitmentRoot)[8..256] == field_to_bool_256(${x}_commitmentRoot_check)[8..256]\\
        )`,
                ];
                if (isWhole && !(isAccessed && !isNullified)) {
                    // initialisation of whole states requires a dummy oldCommitment to be ignored.
                    lines.splice(-1, 0, `
        // Note: Don't bother actually asserting existence, if the oldCommitment is a dummy:
        ${x}_commitmentRoot_check = if ${x}_oldCommitment_isDummy == true then commitmentRoot else ${x}_commitmentRoot_check fi`);
                }
                return lines;
            },
        };
        this.newCommitment = {
            importStatements() {
                return [
                    `from "utils/pack/bool/nonStrictUnpack256.zok" import main as field_to_bool_256`,
                    `from "utils/casts/u32_8_to_bool_256.zok" import main as u32_8_to_bool_256`,
                    `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
                    `from "./common/hashes/sha256/pad1024ThenHash.zok" import main as sha256of1024`,
                    `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
                ];
            },
            parameters({ name: x }) {
                return [
                    `private u32[8] ${x}_newCommitment_owner_publicKey`,
                    `private u32[8] ${x}_newCommitment_salt`,
                    `public field ${x}_newCommitment_commitment`,
                ];
            },
            preStatements({ name: x, id, isMapping }) {
                if (isMapping)
                    return [];
                return [
                    `
        // We need to hard-code each stateVarId into the circuit:
        u32[8] ${x}_stateVarId = field_to_u32_8(${id})`, // TODO: this results in unnecessary unpacking constraints, but simplifies transpilation effort, for now.
                ];
            },
            postStatements({ name: x, isWhole, isNullified, newCommitmentValue }) {
                // if (!isWhole && !newCommitmentValue) throw new Error('PATH');
                const y = isWhole ? x : newCommitmentValue;
                const lines = [];
                if (!isWhole && isNullified) {
                    // decrement
                    const i = parseInt(x.slice(-1), 10);
                    const x0 = x.slice(0, -1) + `${i - 2}`;
                    const x1 = x.slice(0, -1) + `${i - 1}`;
                    lines.push(`assert(${x0} + ${x1} > ${y})
          // TODO: assert no under/overflows

          u32[8] ${x}_newCommitment_value = field_to_u32_8((${x0} + ${x1}) - (${y}))`);
                }
                else {
                    lines.push(`u32[8] ${x}_newCommitment_value = field_to_u32_8(${y})`);
                }
                return [
                    `
        // prepare secret state '${x}' for commitment

        ${lines}

        // ${x}_newCommitment_commitment - preimage check

        u32[8] ${x}_newCommitment_commitment_check = sha256of1024([\\
          ...${x}_stateVarId,\\
          ...${x}_newCommitment_value,\\
          ...${x}_newCommitment_owner_publicKey,\\
          ...${x}_newCommitment_salt\\
        ])

        assert(\\
          field_to_bool_256(${x}_newCommitment_commitment)[8..256] == u32_8_to_bool_256(${x}_newCommitment_commitment_check)[8..256]\\
        )`,
                ];
            },
        };
        this.mapping = {
            importStatements() {
                return [
                    `from "utils/pack/u32/nonStrictUnpack256.zok" import main as field_to_u32_8`,
                    `from "./common/hashes/mimc/altbn254/mimc2.zok" import main as mimc2`,
                ];
            },
            parameters({ mappingKeyName: k }) {
                return [
                    `private field ${k}`, // must be a field, in case we need to do arithmetic on it.
                ];
            },
            preStatements({ id: mappingId, mappingName: m }) {
                return [
                    `
        // We need to hard-code the mappingId's of mappings into the circuit:
        field ${m}_mappingId = ${mappingId}`,
                ];
            },
            postStatements({ name: x, mappingName: m, mappingKeyName: k }) {
                // const x = `${m}_${k}`;
                return [
                    `
        field ${x}_stateVarId_field = mimc2([${m}_mappingId, ${k}])`,
                    `
        u32[8] ${x}_stateVarId = field_to_u32_8(${x}_stateVarId_field)`, // convert to u32[8], for later sha256 hashing
                ];
            },
        };
        this.incrementation = {
            importStatements() {
                return []; // TODO: we might eventually import some underflow/overflow functions.
            },
            statements({ name: x, startIndex: i, addends }) {
                // let y = codeGenerator(addends[0]);
                //
                // for (const addend of addends) {
                //   if (addend !== addend[0])
                //     y += `${addend.precedingOperator} ${codeGenerator(addend)}`;
                // }
                return [
                    `// Testing skipping incrementation of ${x}`
                    // `
                    // // The below represents the incrementation '${x} = ${x} + ${y}':
                    //
                    // field ${x}_${i} = ${y}`,
                ];
            },
        };
        /** Partitioned states need boilerplate for a decrementation, because it's so weird and different from `a = a - b`. Whole states inherit directly from the AST, so don't need boilerplate here. */
        this.decrementation = {
            importStatements() {
                return []; // TODO: we might eventually import some underflow/overflow functions.
            },
            statements({ name: x, startIndex, subtrahend }) {
                // const y = codeGenerator(subtrahend);
                // let i = startIndex;
                // const x0 = `${x}_${i++}`;
                // const x1 = `${x}_${i++}`;
                // const x2 = `${x}_${i}`;
                return [
                    `// Testing moved decrementation of ${x}`
                    // `
                    // // The below represents the decrementation '${x} = ${x} - ${y}':
                    //
                    // assert(${x0} + ${x1} > ${y})
                    // // TODO: assert no under/overflows
                    //
                    // field ${x2} = (${x0} + ${x1}) - ${y}`,
                ];
            },
        };
    }
    generateBoilerplate(node) {
        var _a, _b, _c;
        const { bpSection, bpType } = node, otherParams = __rest(node, ["bpSection", "bpType"]);
        return (_c = (_b = (_a = this === null || this === void 0 ? void 0 : this[bpType]) === null || _a === void 0 ? void 0 : _a[bpSection]) === null || _b === void 0 ? void 0 : _b.call(_a, otherParams)) !== null && _c !== void 0 ? _c : [];
    }
    static uniqueify(arr) {
        return Array.from(new Set(arr));
    }
}
export default BoilerplateGenerator;
