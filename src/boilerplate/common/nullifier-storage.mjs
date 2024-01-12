/* eslint-disable import/no-cycle */
/**
Logic for storing and retrieving nullifiers tree.
*/
import gen from 'general-number';
import Web3 from './web3.mjs';
import logger from './logger.mjs';;
import { poseidonHash } from './number-theory.mjs';
import { SumType, reduceTree, toBinArray, poseidonConcatHash } from './smt_utils.mjs';
import { hlt } from './hash-lookup.mjs';


const { generalise } = gen;

const TRUNC_LENGTH = 32; // Just for testing so we don't make more than 32 deep smt trees.
const WHOLE_STATES = [];
// structure for SMT
const Branch = (leftTree, rightTree) => ({
  tag: 'branch',
  left: leftTree,
  right: rightTree,
});
const Leaf = val => ({
  tag: 'leaf',
  val: val,
});

const SMT = SumType([Branch, Leaf], () => {
  throw new TypeError('Invalid data structure provided');
});

let smt_tree = SMT(hlt[0]);
let temp_smt_tree = SMT(hlt[0]); // for temporary updates before proof generation

// Gets the hash of a smt_tree (or subtree)
export const getHash = tree => reduceTree(poseidonConcatHash, tree);

// This is a helper function to insertLeaf in smt that calls the recursion
function _insertLeaf(val, tree, binArr){
	if (binArr.length > 0) {
	  switch (tree.tag) {
		case 'branch': // Recursively enter developed subtree
		  return binArr[0] === '0'
			? Branch(_insertLeaf(val, tree.left, binArr.slice(1)), tree.right)
			: Branch(tree.left, _insertLeaf(val, tree.right, binArr.slice(1)));
  
			case 'leaf': // Open undeveloped subtree
			return binArr[0] === '0'
			  ? Branch(
				  _insertLeaf(val, Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]), binArr.slice(1)),
				  Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]),
				)
			  : Branch(
				  Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]),
				  _insertLeaf(val, Leaf(hlt[TRUNC_LENGTH - (binArr.length - 1)]), binArr.slice(1)),
				);
	
  
		default: {
		  return tree;
		}
	  }
	} else return Leaf(val);
  };
  
  // This inserts a value into the smt as a leaf
  function insertLeaf(val, tree) {
	const binArr = toBinArray(generalise(val))
	const padBinArr = Array(254 - binArr.length)
		.fill("0")
		.concat(...binArr).slice(0, TRUNC_LENGTH);
	return _insertLeaf(val, tree, padBinArr);
  };

  // This is a helper function for checkMembership
const _getnullifierMembershipWitness = (binArr, element, tree, acc) => {
	switch (tree.tag) {
	  case 'branch':
		return binArr[0] === '0'
		  ? _getnullifierMembershipWitness(
			  binArr.slice(1),
			  element,
			  tree.left,
			  [getHash(tree.right) ].concat(acc),
			)
		  : _getnullifierMembershipWitness(
			  binArr.slice(1),
			  element,
			  tree.right,
			  [getHash(tree.left)].concat(acc),
			);
			case "leaf": {
				if (binArr.length > 0) {
					while (binArr.length > 0) {
						binArr[0] === "0"
							? (acc = [hlt[TRUNC_LENGTH - (binArr.length - 1)]].concat(acc))
							: (acc = [hlt[TRUNC_LENGTH - (binArr.length - 1)]].concat(acc));
						binArr = binArr.slice(1);
					}
					return { isMember: false, path: acc };
				} else {
					return tree.val !== element
						? { isMember: false, path: acc }
						: { isMember: true, path: acc };
				}
			}
	  default:
		return tree;
	}
  };

// If the transaction doesn't go in, we need to reset the temprorary changes that we made to the tree

export async function resetTemporaryNullifierTree() {
	temp_smt_tree = smt_tree;
}

export async function eventUpdateNullifier(nullifiers, nullifierRoot) {
	const root = getHash(smt_tree);
	if(!(nullifierRoot === generalise(root).interger)) {
        nullifiers.forEach(nullifier =>{
			smt_tree = insertLeaf(generalise(nullifier).hex(32), smt_tree);
			temp_smt_tree = smt_tree;
		})
	}	
}


export function getnullifierMembershipWitness(nullifier) {

	const binArr = toBinArray(generalise(nullifier))
	const padBinArr = Array(254 - binArr.length)
		.fill("0")
		.concat(...binArr).slice(0, TRUNC_LENGTH);
	const  membershipPath = _getnullifierMembershipWitness(padBinArr, nullifier, temp_smt_tree, []);
    const root = getHash(temp_smt_tree);
	const witness = {path : membershipPath.path, root: root}
	return witness;

}

export async function temporaryUpdateNullifier(nullifier){
	
	temp_smt_tree = insertLeaf(generalise(nullifier).hex(32), temp_smt_tree);
	
}

export async function reinstateNullifiers() {
	const initialised = [];
	const nullifiedCommitments = await getNullifiedCommitments();
	if (!nullifiedCommitments) {
		logger.info('No nullifiers to add to the tree');
		return;
	}
	logger.warn(
	'Reinstatiating nullifiers - NOTE that any nullifiers added from another client may not be known here, so the tree will be out of sync.',
	);
	for (const c of nullifiedCommitments) {
		if (WHOLE_STATES.includes(c.name) && !initialised.includes(c.preimage.stateVarId)) {
			logger.debug(`initialising state ${c.name}`);
			smt_tree = insertLeaf(poseidonHash([BigInt(c.preimage.stateVarId), BigInt(0), BigInt(0)]).hex(32), smt_tree);
			initialised.push(c.preimage.stateVarId);
		}
		logger.debug(`nullifying state ${c.name}: ${c.nullifier}`);
		smt_tree = insertLeaf(c.nullifier, smt_tree);
	}
	temp_smt_tree = smt_tree;
}

const web3 = Web3.connection();

// // create a event listener for new nullifiers added to the tree

// export class newNullifierReponseFunction {
//     constructor(web3) {
//         this.web3 = web3;
//     }
        
//     async start() {
//     const eventName = 'NewNullifiers';
//     const instance = await getContractInstance(contractName);
//     const eventJsonInterface = instance._jsonInterface.find(
//         o => o.name === eventName && o.type === 'event',
//     );

//     console.log(
//         `Nullifier eventJsonInterface: ${JSON.stringify(eventJsonInterface, null, 2)}`,
//     );

//     const eventSubscription = await instance.events[eventName]({
//         fromBlock: 1,
//         topics: [eventJsonInterface.signature],
//     });

//     eventSubscription
//         .on('connected', function (subscriptionId) {
//         console.log(`New subscription: ${subscriptionId}`);
//         })
//         .on('data', async eventData => {
//         console.log(`New ${eventName} event detected`);
//         console.log(`Event Data: ${JSON.stringify(eventData, null, 2)}`);

//         const newNullifiers = eventData.returnValues.nullifiers;
//         const newNullfiersRoot = eventData.returnValues.nullifierRoot;
        
//             await eventUpdateNullifier(newNullifiers, newNullfiersRoot);
//         });
//         }
// }


const EventEmitter = require('events');

export class NewNullifierReponseFunction extends EventEmitter {
    constructor(web3) {
        super();
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
                const newNullifiersRoot = eventData.returnValues.nullifierRoot;

                // Emit a custom event with the relevant data
                this.emit('newNullifierEvent', {
                    nullifiers: newNullifiers,
                    nullifiersRoot: newNullifiersRoot,
                });

                await eventUpdateNullifier(newNullifiers, newNullifiersRoot);
            });
    }
}


