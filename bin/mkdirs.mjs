import fs from 'fs';

export default ({
  outputDirPath,
  parseDirPath,
  circuitsDirPath,
  contractsDirPath,
  orchestrationDirPath,
}) => {
  try {
    fs.mkdirSync(outputDirPath, {
      recursive: true,
    });
  } catch (err) {
    throw new Error(`Failed to create the output directory ${outputDirPath}`);
  }

  if (!fs.existsSync(parseDirPath)) fs.mkdirSync(parseDirPath);
  if (!fs.existsSync(circuitsDirPath)) fs.mkdirSync(circuitsDirPath);
  if (!fs.existsSync(contractsDirPath)) fs.mkdirSync(contractsDirPath);
  if (!fs.existsSync(orchestrationDirPath)) fs.mkdirSync(orchestrationDirPath);
};
