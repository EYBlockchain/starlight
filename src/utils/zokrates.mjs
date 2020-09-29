import config from 'config';
import axios from 'axios';

import logger from './logger.mjs';

const { url } = config.zokrates;

/**
POST inputs to a circuit (and receive a proof in return)
@param {string} functionName
@param {Array(field)} inputs is the set of 'field' values (both public & private) which are to be passed to the main() function of a zokrates `.zok` file.
*/
export const generateProof = async (functionName, inputs) => {
  logger.http(`\nCalling zokrates/generate-proof(${functionName})`);
  const folderPath = `${functionName}`;
  try {
    const axiosConfig = {
      method: 'post',
      url: `${url}/generate-proof`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        folderPath,
        inputs,
      },
      timeout: 3600000, // 1 hour
    };

    const response = await axios(axiosConfig);

    logger.http('Zokrates responded to the generateProof request', response.data);
    return response.data;
  } catch (error) {
    throw new Error(error);
  }
};

export { generateProof as default };
