;
import Web3 from "./web3.mjs";
import { eventUpdateNullifier } from './commitment-storage.mjs';
import { getContractInstance } from "./contract.mjs";

const web3 = Web3.connection();

// create a event listener 

export class newNullifierReponseFunction {
    constructor(web3) {
        this.web3 = web3;
    }
        
async start() {
const eventName = 'NewNullifiers';
const instance = await getContractInstance(contractName);
const eventJsonInterface = instance._jsonInterface.find(
    o => o.name === eventName && o.type === 'event',
);

console.log(
    `Nullifier eventJsonInterface: ${JSON.stringify(eventJsonInterface, null, 2)}`,
);

const eventSubscription = await instance.events[eventName]({
    fromBlock: 1,
    topics: [eventJsonInterface.signature],
});

eventSubscription
    .on('connected', function (subscriptionId) {
    console.log(`New subscription: ${subscriptionId}`);
    })
    .on('data', async eventData => {
    console.log(`New ${eventName} event detected`);
    console.log(`Event Data: ${JSON.stringify(eventData, null, 2)}`);

    const newNullifiers = eventData.returnValues.nullifiers;
    const newNullfiersRoot = eventData.returnValues.nullifierRoot;
    
        await eventUpdateNullifier(newNullifiers, newNullfiersRoot);
    });
    }
    }
      
