import config from "config";
import axios from "axios";

import logger from "./logger.mjs";

const { url } = config.zokrates;

/**
POST inputs to a circuit (and receive a proof in return)
@param {string} functionName
@param {Array(field)} inputs is the set of 'field' values (both public & private) which are to be passed to the main() function of a zokrates `.zok` file.
*/
export const generateProof = async (functionName, inputs) => {
	logger.http(`\nCalling zokrates/generate-proof(${functionName})`);
	const folderpath = `${functionName}`;
	try {
		const axiosConfig = {
			method: "post",
			url: `${url}/generate-proof`,
			headers: {
				"Content-Type": "application/json",
			},
			data: {
				folderpath,
				inputs,
				backend: "bellman",
				provingScheme: "g16",
			},
			timeout: 3600000, // 1 hour
		};

		const response = await axios(axiosConfig);

		logger.http(
			"Zokrates responded to the generateProof request",
			response.data
		);
		return response.data;
	} catch (error) {
		throw new Error(error);
	}
};

/**
 * This will create proving and verification key for the circuits which zokrates microservice will store
 *
 * @param {string} circuitFileName - Name of the circuit to generate keys for (including file extension!)
 * @return {Object} vk
 */
export const generateKeys = async (circuitFileName) => {
	const filepath = `${circuitFileName}`;
	//logger.info('Generating Keys for Circuit: ', circuitFileName);
	try {
		const axiosConfig = {
			method: "post",
			url: `${url}/generate-keys`,
			headers: {
				"Content-Type": "application/json",
			},
			data: {
				filepath,
				curve: "bn128",
				provingScheme: "g16",
				backend: "bellman",
			},
			timeout: 3600000, // 1 hour
		};
		const response = await axios(axiosConfig);
		const { vk } = response.data;
		delete vk.raw;
		logger.info(
			`ZoKrates Microservice generated Keys for circuit: ${circuitFileName}`
		);
		console.log(vk);

		return vk;
	} catch (err) {
		throw new Error(err);
	}
};
