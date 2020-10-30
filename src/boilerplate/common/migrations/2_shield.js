const fs = require('fs');

const BN256G2 = artifacts.require("BN256G2");
const Verifier = artifacts.require("Verifier");
const CONTRACT_NAME = artifacts.require("CONTRACT_NAME");
const vkJson = JSON.parse(fs.readFileSync('/app/orchestration/common/db/FUNCTION_NAME_vk.key', 'utf-8'));
const vkInput = Object.values(vkJson).flat(Infinity);
vkInput.splice(-1, 1);

module.exports = deployer => {
  deployer.then(async () => {
    await deployer.deploy(BN256G2);
    await deployer.link(BN256G2, Verifier);
    await deployer.deploy(Verifier);
    console.log(vkInput);
    await deployer.deploy(CONTRACT_NAME, Verifier.address, vkInput);
  });
};
