/* eslint-disable import/no-cycle */

import _ from "lodash";

class ContractBoilerplateGenerator {
  generateBoilerplate(node: any) {
    const { bpSection, bpCategory, ...otherParams } = node;
    return this?.[bpCategory]?.[bpSection]?.(otherParams) ?? [];
  }

  static uniqueify(arr: any[]) {
    return Array.from(new Set(arr));
  }

  contract = {
    importStatements({ newCommitmentsRequired }): string[] {
      return [
        `import "./verify/IVerifier.sol";`,
        ...(newCommitmentsRequired ? [`import "./merkle-tree/MerkleTree.sol";`] : []),
      ];
    },

    stateVariableDeclarations({
      functionNames,
      oldCommitmentAccessRequired,
      nullifiersRequired,
      newCommitmentsRequired,
      encryptionRequired,
      //isInternalFunctionCall add it
    }): string[] {
      // prettier-ignore
      // Ignoring prettier because it's easier to read this if the strings we're inserting are at the beginning of a line.
      return [
        `
          enum FunctionNames { ${functionNames.join(', ')} }`,

        `
          IVerifier private verifier;`,

        `
          mapping(uint256 => uint256[]) public vks; // indexed to by an enum uint(FunctionNames)`,

        ...(encryptionRequired ? [`
          event EncryptedData(uint256[] cipherText, uint256[2] ephPublicKey);`] : []),

        ...(newCommitmentsRequired ? [`
        struct BackupDataElement {
          string varName;
          uint256[] cipherText;
          uint256 ephPublicKey;
      } \n
          event EncryptedBackupData(BackupDataElement[] encPreimages); 
          `] : []),

        ...nullifiersRequired ? [`
          uint256 public newNullifierRoot;`] : [],

        ...(oldCommitmentAccessRequired ? [`
          mapping(uint256 => uint256) public commitmentRoots;`] : []),

        ...(newCommitmentsRequired ? [`
          uint256 public latestRoot;`] : []),

        `
          mapping(address => uint256) public zkpPublicKeys;`, // TODO: consider whether we need to identify when / when not to include this.

        `
          struct Inputs {
            ${[
              ...(nullifiersRequired ? [`uint nullifierRoot; 
              uint latestNullifierRoot; 
              uint[] newNullifiers;
                  `] : []),
              ...(oldCommitmentAccessRequired ? [`uint commitmentRoot;`] : []),
              ...(newCommitmentsRequired ? [`uint[] newCommitments;`] : []),
              ...(encryptionRequired ? [`uint[][] cipherText;`] : []),
              ...(encryptionRequired ? [`uint[2][] encKeys;`] : []),
              `uint[] customInputs;`, // TODO: consider whether we need to identify when / when not to include this.
            ].join('\n\t\t\t\t\t\t')}
          }`,
      ];
    },

    constructor({nullifiersRequired}): string[] {
      // This boilerplate will only be used if the .zol developer didn't write their own constructor. If they already wrote a constructor, we add this boilerplate in the FunctionBoilerplate generator.
      return [
        `
        constructor (
      		address verifierAddress,
      		uint256[][] memory vk
      	) {
      		verifier = IVerifier(verifierAddress);
      		for (uint i = 0; i < vk.length; i++) {
      			vks[i] = vk[i];
      		}`,
          ...( nullifiersRequired ? [`
          newNullifierRoot = Initial_NullifierRoot;`] : []),        
      	  `
        }`,
      ];
    },


    registerZKPPublicKey(): string[] {
      return [
        `
        function registerZKPPublicKey(uint256 pk) external {
      		zkpPublicKeys[msg.sender] = pk;
      	}
        `,
      ];
    },

    verify({
      oldCommitmentAccessRequired: commitmentRoot,
      nullifiersRequired: newNullifiers,
      newCommitmentsRequired: newCommitments,
      encryptionRequired,
      circuitParams,
      constructorContainsSecret,
      isjoinSplitCommitmentsFunction,
    }): string[] {
      const verifyFunctionSignature = `
        function verify(
      		uint256[] ${constructorContainsSecret ? `memory` : `calldata`} proof,
      		uint256 functionId,
      		Inputs memory _inputs
      	) private {
        `;
      let verifyInput: string[] = [];
  
      const verifyInputsMap = (type: string, input: string, counter: any) => {
        if(type  === 'parameters'){
        switch (input) {
          case 'nullifierRoot':  
            verifyInput.push( `
            inputs[k++] = _inputs.nullifierRoot;`);  
            break; 
          case 'newNullifierRoot':  
            verifyInput.push( `
            inputs[k++] = _inputs.latestNullifierRoot;`); 
            break; 
          case 'nullifier':  
            verifyInput.push( `
            inputs[k++] = newNullifiers[${counter.newNullifiers++}];`); 
            break;
          case 'newCommitment':
            verifyInput.push(`
            inputs[k++] = newCommitments[${counter.newCommitments++}];`);
            break;
          case 'oldCommitmentExistence':
            verifyInput.push( `
            inputs[k++] = _inputs.commitmentRoot;`);
            break;
          default:
            verifyInput.push( `
            inputs[k++] = customInputs[${counter.customInputs++}];`);
            break;
        }
      }
        else if(type  === 'returnParameters' || type  === 'encryptionParameters') {
          switch (input) {
            case 'encryption':
              verifyInput.push( `
              for (uint j; j < _inputs.cipherText[${counter.encryption}].length; j++) {
              inputs[k++] = _inputs.cipherText[${counter.encryption}][j];
            }`);
              verifyInput.push( `
              inputs[k++] = _inputs.encKeys[${counter.encryption}][0];`);
              verifyInput.push( `
              inputs[k++] = _inputs.encKeys[${counter.encryption}][1];`);
              counter.encryption++
              break; 
            default:
              verifyInput.push( `
              inputs[k++] = ${input};`
              );
              break;
          }

        }
      }
      // prettier-ignore
      // Ignoring prettier because it's easier to read this if the strings we're inserting are at the beginning of a line.
      const verifyPreStatements: string[] = [
        'uint[] memory customInputs = _inputs.customInputs;', // TODO: do we need an indicator for when there are / aren't custom inputs? At the moment they're always assumed:

        ...(newNullifiers ? [`
          uint[] memory newNullifiers = _inputs.newNullifiers;`] : []),

        // removed to prevent stack too deep err - converted commitmentRoot to _inputs.commitmentRoot below
        // ...(commitmentRoot ? [`
        //   uint commitmentRoot = _inputs.commitmentRoot;`] : []),

        ...(newCommitments ? [`
          uint[] memory newCommitments = _inputs.newCommitments;`] : []),

        ...(commitmentRoot ? [`
          require(commitmentRoots[_inputs.commitmentRoot] == _inputs.commitmentRoot, "Input commitmentRoot does not exist.");`] : []),

        
        ...(encryptionRequired ? [`
          uint encInputsLen = 0;

          for (uint i; i < _inputs.cipherText.length; i++) {
            encInputsLen += _inputs.cipherText[i].length + 2;
          }`] : []),

          `
            uint256[] memory inputs = new uint256[](${[
            'customInputs.length',
            ...(newNullifiers ? ['newNullifiers.length'] : []),
            ...(commitmentRoot ? ['(newNullifiers.length > 0 ? 3 : 0)'] : []), // newNullifiers and commitmentRoot are always submitted together (regardless of use case). It's just that nullifiers aren't always stored (when merely accessing a state). and  commitmentRoot are always submitted together (regardless of use case). It's just that nullifiers aren't always stored (when merely accessing a state).
            ...(newCommitments ? ['newCommitments.length'] : []),
            ...(encryptionRequired ? ['encInputsLen'] : []),
          ].join(' + ')});`,

      ];
      const verifyInputs: string[] = [];
      const joinSplitCommitmentsInputs: string[] = [];
      for (let [name, _params] of Object.entries(circuitParams)) {
        if (_params) 
          for (let [type, _inputs] of Object.entries(_params)) {
            if(type  === 'parameters' && _inputs.includes('nullifierRoot')) verifyInput.push(` 
            require(newNullifierRoot == _inputs.nullifierRoot, "Input NullifierRoot does not exist.");`) 
            const counter = {
              customInputs: 0,
              newNullifiers: 0,
              newCommitments: 0,
              encryption: 0,
            };
            _inputs?.map(i => verifyInputsMap(type, i, counter));
           

           
          }
          
          if(_params && !(Object.keys(_params).includes('returnParameters')) &&!(Object.keys(_params).includes('encryptionParameters'))) verifyInput.push(`
            inputs[k++] = 1;`) 
      
        verifyInputs.push(`
          if (functionId == uint(FunctionNames.${name})) {
            uint k = 0;
            ${verifyInput.join('')}
            
          }`)
          verifyInput =[];
      }

      const verification: string[] = [
        `
          bool result = verifier.verify(proof, inputs, vks[functionId]);`,

      	`
          require(result, "The proof has not been verified by the contract");`,

        // eslint-disable-next-line no-nested-ternary
        ...((newCommitments && commitmentRoot) ? [`
          if (newCommitments.length > 0) {
      			latestRoot = insertLeaves(newCommitments);
      			commitmentRoots[latestRoot] = latestRoot;
      		}`] :
          newCommitments ? [`
            insertLeaves(newCommitments);`] :
          []      
        ),

        ...(newNullifiers) ? [`
       if (newNullifiers.length > 0) {
        newNullifierRoot = _inputs.latestNullifierRoot;
      }`] : [] 
      ];

      if (isjoinSplitCommitmentsFunction?.includes('true')) {

       joinSplitCommitmentsInputs.push(
        `
           function joinCommitments(uint256 nullifierRoot, uint256 latestNullifierRoot, uint256[] calldata newNullifiers,  uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata proof) public {

            Inputs memory inputs;

            inputs.customInputs = new uint[](1);
        	  inputs.customInputs[0] = 1;

            inputs.nullifierRoot = nullifierRoot;

            inputs.latestNullifierRoot = latestNullifierRoot;

            inputs.newNullifiers = newNullifiers;

            inputs.commitmentRoot = commitmentRoot;

            inputs.newCommitments = newCommitments;

            verify(proof, uint(FunctionNames.joinCommitments), inputs);
        }
        
        function splitCommitments(uint256 nullifierRoot, uint256 latestNullifierRoot, uint256[] calldata newNullifiers,  uint256 commitmentRoot, uint256[] calldata newCommitments, uint256[] calldata proof) public {

          Inputs memory inputs;

          inputs.customInputs = new uint[](1);
          inputs.customInputs[0] = 1;

          inputs.nullifierRoot = nullifierRoot;

          inputs.latestNullifierRoot = latestNullifierRoot;

          inputs.newNullifiers = newNullifiers;

          inputs.commitmentRoot = commitmentRoot;

          inputs.newCommitments = newCommitments;

          verify(proof, uint(FunctionNames.splitCommitments), inputs);
      }`)
       verifyInputs.push(`

       if (functionId == uint(FunctionNames.joinCommitments)) {

          
        require(newNullifierRoot == _inputs.nullifierRoot, "Input NullifierRoot does not exist.");

         uint k = 0;

         inputs[k++] = _inputs.nullifierRoot;
         inputs[k++] = _inputs.latestNullifierRoot;
         inputs[k++] = newNullifiers[0];
         inputs[k++] = newNullifiers[1];
         inputs[k++] = _inputs.commitmentRoot;
         inputs[k++] = newCommitments[0];
         inputs[k++] = 1;
              
       }
         
         if (functionId == uint(FunctionNames.splitCommitments)) {

          
          require(newNullifierRoot == _inputs.nullifierRoot, "Input NullifierRoot does not exist.");

           uint k = 0;

           inputs[k++] = _inputs.nullifierRoot;
           inputs[k++] = _inputs.latestNullifierRoot;
           inputs[k++] = newNullifiers[0];
           inputs[k++] = _inputs.commitmentRoot;
           inputs[k++] = newCommitments[0];
           inputs[k++] = newCommitments[1];
           inputs[k++] = 1;
                
         }`)

       }

      const verify = [
        `${verifyFunctionSignature}
          ${verifyPreStatements.join('\n')}
          ${verifyInputs.join('\n')}
          ${verification.join('\n')}
        }`,
        `${joinSplitCommitmentsInputs}`
      ];


      return verify;
    },

  };
}

export default ContractBoilerplateGenerator;
