const fs = require("fs");

const Pairing = artifacts.require("Pairing");
const Verifier = artifacts.require("Verifier");

const constructorInput = JSON.parse(
	fs.readFileSync("/app/orchestration/common/db/constructorTx.json", "utf-8")
);

const { proofInput } = constructorInput;
const OwnerShield = artifacts.require("OwnerShield");
const functionNames = ["cnstrctr", "alpha", "beta", "gamma"];
const vkInput = [];
let vk = [];
functionNames.forEach((name) => {
	const vkJson = JSON.parse(
		fs.readFileSync(`/app/orchestration/common/db/${name}_vk.key`, "utf-8")
	);
	if (vkJson.scheme) {
		vk = Object.values(vkJson).slice(2).flat(Infinity);
	} else {
		vk = Object.values(vkJson).flat(Infinity);
	}
	vkInput.push(vk);
});

module.exports = (deployer) => {
	deployer.then(async () => {
		await deployer.deploy(Pairing);
		await deployer.link(Pairing, Verifier);
		await deployer.deploy(Verifier);

		await deployer.deploy(
			OwnerShield,
			Verifier.address,
			vkInput,
			...proofInput
		);
	});
};
