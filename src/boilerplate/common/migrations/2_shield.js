const fs = require('fs');

const Pairing = artifacts.require("Pairing");
const Verifier = artifacts.require("Verifier");
CUSTOM_CONTRACT_IMPORT
CUSTOM_PROOF_IMPORT
const CONTRACT_NAME = artifacts.require("CONTRACT_NAME");
const functionNames = [FUNCTION_NAMES];
const vkInput = [];
let vk = [];
functionNames.forEach(name => {
  const vkJson = JSON.parse(
    fs.readFileSync(`/app/orchestration/common/db/${name}_vk.key`, 'utf-8'),
  );
  if (vkJson.scheme) {
    vk = Object.values(vkJson).slice(2).flat(Infinity);
  } else {
    vk = Object.values(vkJson).flat(Infinity);
  }  
  vkInput.push(vk);
});

module.exports = deployer => {
  deployer.then(async () => {
    await deployer.deploy(Pairing);
    await deployer.link(Pairing, Verifier);
    await deployer.deploy(Verifier);
    CUSTOM_CONTRACTS
    await deployer.deploy(CONTRACT_NAME, CUSTOM_INPUTS Verifier.address, vkInput CUSTOM_PROOF);
  });
};
