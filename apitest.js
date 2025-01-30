import shell from 'shelljs';

const SERVER_URL = 'http://localhost:3000';

// Function to wait for the API to be ready
const waitForServer = async (retries = 10, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    const response = shell.exec(`curl -s -o /dev/null -w "%{http_code}" ${SERVER_URL}`, { silent: true });
    if (response.stdout.trim() === "200") {
      console.log("API is up and running.");
      return;
    }
    console.log(`⏳ Waiting for API to start... Attempt ${i + 1}/${retries}`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  throw new Error("API did not start in time.");
};

// Function to make API calls using curl
const callAPI = (method, endpoint, data = null) => {
  const url = `${SERVER_URL}${endpoint}`;
  let curlCommand = `curl -s -X ${method} "${url}" -H "Content-Type: application/json"`;
  if (data) {
    curlCommand += ` -d '${JSON.stringify(data)}'`;
  }
  const response = shell.exec(curlCommand, { silent: true });
  return JSON.parse(response.stdout);
};

// Step 1: Start the API
console.log("Starting API...");
if (shell.exec('./apiactions -z Assign').code !== 0) {
  shell.echo('apiactions failed to start');
  shell.exit(1);
}

// Step 2: Wait for the API to be ready
await waitForServer();

// Step 3: Run API requests
const res = [];
res[0] = callAPI('POST', '/add', { value: 11 });
res[1] = callAPI('POST', '/add', { value: 8 });
res[2] = callAPI('POST', '/remove', { value: 16 });
res[3] = callAPI('GET', '/getAllCommitments');
res[4] = callAPI('GET', '/getCommitmentsByVariableName', { name: 'a' });

// Step 4: Stop and remove the container
shell.exec('docker stop $(docker ps -q)');
shell.exec('docker rm apiservice');

// Step 5: Restart API for another test
await new Promise(resolve => setTimeout(resolve, 5000));
if (shell.exec('./apiactions -z If-Statement').code !== 0) {
  shell.echo('IfStatement failed');
  shell.exit(1);
}

// Step 6: Run next set of API requests
res[5] = callAPI('POST', '/add', { y: 14 });
res[6] = callAPI('POST', '/add', { y: 23 });
res[7] = callAPI('GET', '/getAllCommitments');
res[8] = callAPI('GET', '/getCommitmentsByVariableName', { name: 'x', mappingKey: '827641930419614124039720421795580660909102123457' });
res[9] = callAPI('GET', '/getCommitmentsByVariableName', { name: 'z' });

// Step 7: Stop and remove container again
shell.exec('docker stop $(docker ps -q)');
shell.exec('docker rm apiservice');

// Step 8: Restart API for final test
await new Promise(resolve => setTimeout(resolve, 5000));
if (shell.exec('./apiactions -z internalFunctionCallTest1').code !== 0) {
  shell.echo('InternalFunctionCallTest1 failed');
  shell.exit(1);
}

// Step 9: Run final set of API requests
res[10] = callAPI('POST', '/add', { value: 46 });
res[11] = callAPI('POST', '/remove', { value: 33 });
res[12] = callAPI('GET', '/getAllCommitments');
res[13] = callAPI('POST', '/add', { value: 63 });
res[14] = callAPI('POST', '/remove', { value: 55 });
res[15] = callAPI('GET', '/getAllCommitments');

// Step 10: Stop and remove container
shell.exec('docker stop $(docker ps -q)');
shell.exec('docker rm apiservice');

// Step 11: Print results (for debugging)
//console.log(JSON.stringify(res, null, 2));
