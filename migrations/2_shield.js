const fs = require('fs');

const BN256G2 = artifacts.require("BN256G2");
const Verifier = artifacts.require("Verifier");
const AssignShield = artifacts.require("AssignShield");
const vkJson = JSON.parse(
  fs.readFileSync('/app/examples/cases/uninit_global/db/assign_vk.key', 'utf-8'),
);
const vkInput = Object.values(vkJson).flat(Infinity);
vkInput.splice(-1, 1);

module.exports = deployer => {
  deployer.then(async () => {
    await deployer.deploy(BN256G2);
    await deployer.link(BN256G2, Verifier);
    await deployer.deploy(Verifier);
    await deployer.deploy(AssignShield, Verifier.address, vkInput);
  });
};
