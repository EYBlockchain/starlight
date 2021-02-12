import fs from 'fs';

export const readJsonFile = filePath => {
  try {
    const file = fs.readFileSync(filePath);
    return JSON.parse(file);
  } catch (err) {
    throw new Error(err);
  }
};

export const writeJsonFile = (filePath, object) => {
  // this will overwrite any existing file:
  try {
    fs.writeFileSync(filePath, JSON.stringify(object, null, 2));
  } catch (err) {
    throw new Error(err);
  }
};
