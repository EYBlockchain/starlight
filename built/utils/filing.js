/* eslint-disable babel/camelcase */
import fs from 'fs';
// import path from 'path';
export const readJsonFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        const file = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(file);
    }
    console.log('Unable to locate file: ', filePath);
    return null;
};
export const writeJsonFile = (filePath, jsonObject) => {
    // this will overwrite any existing file:
    try {
        fs.writeFileSync(filePath, JSON.stringify(jsonObject));
    }
    catch (err) {
        throw new Error(err);
    }
};
