/**
Module to set up zkp elements of compiler output, along with writing the vks to the db folder. To be run from inside the zokrates container.
*/

import fs from "fs";
import yargs from "yargs";

// const { generalise } = GN;
const { argv } = yargs.usage("Usage: $0 -i <input file>").demandOption(["i"]);
const functionNames = ["assign"];

const readFile = (filePath) => {
	if (fs.existsSync(filePath)) {
		return fs.readFileSync(filePath, "utf-8");
	}
	console.log("Unable to locate file: ", filePath);
	return null;
};

export const writeFile = (filePath, data) => {
	// this will overwrite any existing file:
	try {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
	} catch (err) {
		throw new Error(err);
	}
};

export const writeVK = async (functionName) => {
	if (!functionName) {
		functionNames.forEach((name) => {
			const sourcePath = `/app/output/${name}/${name}_vk.key`; // won't change
			const destinationPath = `/app/orchestration/common/db/${name}_vk.key`; // TODO - change to output of compiler
			if (!fs.existsSync(`/app/orchestration/common/db/`))
				fs.mkdirSync(`/app/orchestration/common/db/`, { recursive: true });
			const vk = JSON.parse(readFile(sourcePath));
			writeFile(destinationPath, vk);
		});
	} else {
		const sourcePath = `/app/output/${functionName}/${functionName}_vk.key`; // won't change
		const destinationPath = `/app/orchestration/common/db/${functionName}_vk.key`; // TODO - change to output of compiler
		if (!fs.existsSync(`/app/orchestration/common/db/`))
			fs.mkdirSync(`/app/orchestration/common/db/`, { recursive: true });
		const vk = JSON.parse(readFile(sourcePath));
		writeFile(destinationPath, vk);
	}
};

writeVK(argv.i);
