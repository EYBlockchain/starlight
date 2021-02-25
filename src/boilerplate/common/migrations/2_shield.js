const fs = require('fs');

const BN256G2 = artifacts.require("BN256G2");
const Verifier = artifacts.require("Verifier");
CUSTOM_CONTRACT_IMPORT
const CONTRACT_NAME = artifacts.require("CONTRACT_NAME");
const functionNames = [FUNCTION_NAMES];
const vkInput = [];
functionNames.forEach(name => {
  const vkJson = JSON.parse(
    fs.readFileSync(`/app/orchestration/common/db/${name}_vk.key`, 'utf-8'),
  );
  const vk = Object.values(vkJson).flat(Infinity);
  vk.splice(-1, 1);
  vkInput.push(vk);
});

module.exports = deployer => {
  deployer.then(async () => {
    await deployer.deploy(BN256G2);
    await deployer.link(BN256G2, Verifier);
    await deployer.deploy(Verifier);
    CUSTOM_CONTRACTS
    await deployer.deploy(CONTRACT_NAME, CUSTOM_INPUTS Verifier.address, vkInput);
  });
};
