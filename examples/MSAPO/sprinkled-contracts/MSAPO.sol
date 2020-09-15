// SPDX-License-Identifier: CC0-1.0

// TO DO sprinkle with keywords

pragma solidity ^0.6.10;
import "../access/Ownable.sol";

contract MSAPO is Ownable {

    struct MSA {
        address supplier;
        address buyer;
        bytes32 sku;
        uint256[] tierBounds;
        uint256[] pricesByTier;
        address currency;
        uint256 accumulatedVolumeOrdered;
    }
    mapping(uint256 => MSA) MSAlist;

    struct PO {
        address supplier;
        address buyer;
        bytes32 sku;
        uint256 volume;
        uint256 price;
        address currency;
    }
    mapping(uint256 => PO) POlist;

    constructor (
    ) public {
        _owner = msg.sender;
    }

    function close() external onlyOwner {
        selfdestruct(address(uint160(_owner)));
    }

    function createMSA(
        uint256 id,
        address supplier,
        address buyer,
        bytes32 sku,
        uint256[] calldata tierBounds,
        uint256[] calldata pricesByTier,
        address currency
    ) external {
        require(supplier == msg.sender || buyer == msg.sender);
        // Missing step: verifySignature of buyer on MSAlist[id]
        // Missing step: verifySignature of supplier on MSAlist[id]
        // Make sure that MSA is added to MSAlist after signatures. Private creation one of variable such as MSA can't be done in steps in ZKP.
        MSAlist[id] = MSA(supplier, buyer, sku, tierBounds, pricesByTier, currency, 0); //id = hash of all the inputs ?
    }

    function createPO(
        uint msaID,
        uint256 id,
        address supplier,
        address buyer,
        bytes32 sku,
        uint256 volume,
        address currency
    ) external {
        require(MSAlist[msaID].supplier == supplier);
        require(MSAlist[msaID].buyer == buyer);
        require(MSAlist[msaID].sku == sku);
        require(MSAlist[msaID].currency == currency);
        require(MSAlist[msaID].accumulatedVolumeOrdered + volume >= MSAlist[msaID].tierBounds[0]);
        require(MSAlist[msaID].accumulatedVolumeOrdered + volume <= MSAlist[msaID].tierBounds[MSAlist[msaID].tierBounds.length-1]);

        MSAlist[msaID].accumulatedVolumeOrdered = MSAlist[msaID].accumulatedVolumeOrdered + volume;
        uint256 price = calculateAmountOwed(MSAlist[msaID].tierBounds, MSAlist[msaID].pricesByTier, MSAlist[msaID].accumulatedVolumeOrdered, volume);
        POlist[id] = PO(supplier, buyer, sku, volume, price, currency); //id = hash of all the inputs ?
    }

    function calculateAmountOwed(
    uint256[] memory tierBounds, // TO DO passing static sized arrays
    uint256[] memory pricesByTier,
    uint256 oldCumulativeVolume,
    uint256 thisVolume
    ) internal returns(uint256) {
        uint256 newCumulativeVolume = oldCumulativeVolume + thisVolume;

        uint256[] memory lowerBoundForTier;
        for(uint256 i = 0; i < tierBounds.length/2; i++) { // TO DO writing static sized loops
            if(oldCumulativeVolume >= tierBounds[i]) {
                lowerBoundForTier[i] = oldCumulativeVolume;
            }
            else if(oldCumulativeVolume > tierBounds[i + 1]) {
                lowerBoundForTier[i] =  tierBounds[i + 1];
            }
            else {
                lowerBoundForTier[i] =  tierBounds[i];
            }
        }

        uint256[] memory upperBoundForTier;
        for(uint256 i = 0; i < tierBounds.length/2; i++) { // TO DO writing static sized loops
            if(newCumulativeVolume <= tierBounds[i + 1]) {
                upperBoundForTier[i] = newCumulativeVolume;
            }
            else if(newCumulativeVolume < tierBounds[i]) {
                upperBoundForTier[i] =  tierBounds[i];
            }
            else {
                upperBoundForTier[i] =  tierBounds[i + 1];
            }
        }

        uint256 amountOwed;
        for(uint256 i = 0; i < pricesByTier.length; i++){
            amountOwed = pricesByTier[i] * (upperBoundForTier[i] - lowerBoundForTier[i]);
        }

    return amountOwed;
    }
}

// hashOfTieredPricing, minVolume, maxVolume in MSA
// No createInvoice to keep it simple for now. Next iteration include invoice which means QFT mint, transfer etc are needed too
