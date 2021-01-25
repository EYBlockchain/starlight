import fs from 'fs';

export const readJsonFile = filePath => {
  if (fs.existsSync(filePath)) {
    const file = fs.readFileSync(filePath);
    return JSON.parse(file);
  }
  console.warn('Unable to locate file: ', filePath);
  return null;
};

export const writeJsonFile = (filePath, object) => {
  // this will overwrite any existing file:
  try {
    fs.writeFileSync(filePath, JSON.stringify(object, null, 2));
  } catch (err) {
    throw new Error(err);
  }
};
