pragma solidity ^0.5.8;

import "./ERC20Interface.sol";
import "./ERC1155Interface.sol";

contract PriceVolumeProcess {

    ERC20Interface public erc20Contract;
    ERC1155Interface public erc1155Contract;

    struct MSA = {
        address buyer;
        address supplier;
        uint256[] volumeTierBounds;
        uint256[] pricesByTier;
        bytes32 sku;
        address erc20ContractAddress;
        uint256 accumulatedVolumeOrdered;
        uint256 accumulatedVolumeDelivered;
    }

    struct PO = {
        bytes32 msaId;
        uint256 volume;
        uint256 price;
        uint256 accumulatedVolumeDelivered;
    }

    struct Invoice = {
        bytes32 poId;
        uint256 volume;
        uint256 amountOwed;
        uint256 accumulatedAmountPaid;
    }

    struct Signature = {
        address p;
        bytes32 hashOfMessage;
        bytes32 message;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    mapping (bytes32 => MSA) MSAs;
    mapping (bytes32 => PO) POs;
    mapping (bytes32 => Invoice) Invoices;


    /**
      @param p - purported address of the signer
      @param hash - the hash of the message which has been signed
      @param v, r, s - the signed message
    */
    function verifySignature(address p, bytes32 hashOfMessage, uint8 v, bytes32 r, bytes32 s) constant returns(bool) {
        // Note: this only verifies that signer is correct.
        // You'll also need to verify that the hash of the data
        // is also correct.
        require(ecrecover(hash, v, r, s) == p, "message not signed by alleged public key");

        return;
    }


    function checkStrictlyAscending(uint256[] values) returns (bool result) {
        result = true;
        for (uint i = 0, i < values.length - 1, i++) {
            if (values[i] >= values[i - 1]) {
                result = false;
                break;
            }
        }
        return result;
    }


    function calculateAmountOwed(uint256[] volumes, uint256[] prices, uint256 oldVolume, uint256 volume) returns (uint256) {

        for (uint i = 0; i < volumes.length; i++) {
            // add code here?
        }
    }


    function createMSA (
        uint8 _v_supplier,
        bytes32 _r_supplier,
        bytes32 _s_supplier,
        uint8 _v_buyer,
        bytes32 _r_buyer,
        bytes32 _s_buyer,
        bytes32 _msaId,
        address _buyer,
        address _supplier,
        uint256[] calldata _volumeTierBounds,
        uint256[] calldata _pricesByTier,
        bytes32 _sku
        address _erc20ContractAddress,
    ) {

// CALCULATIONS & CHECKS:

  // UNIQUENESS
        require(MSAs[_msaId] == 0, "msaId already exists");

  // SIGNATURE VERIFICATION
        verifySignature(_buyer, _msaId, _v_buyer, _r_buyer, _s_buyer);
        verifySignature(_supplier, _msaId, _v_supplier, _r_supplier, _s_supplier);

  // MSA DATA VALIDATION
        require(
            checkStrictlyAscending(_volumeTierBounds) == true,
            "volume tier bounds must be strictly ascending"
        );

        // we wouldn't think to check dotProduct(prices, volumes) < 2^254, so how to infer this from this code?

// STORAGE:
        MSA memory msa;
        msa.buyer = _buyer;
        msa.supplier = _supplier;
        msa.volumeTierBounds = _volumeTierBounds;
        msa.pricesByTier = _pricesByTier;
        msa.sku = _sku;
        msa.erc20ContractAddress = _erc20ContractAddress;
        msa.accumulatedVolumeOrdered = 0;
        msa.accumulatedVolumeDelivered = 0;

        MSAs[_msaId] = msa;
    }


    function createPO (
        uint256 _msaId,
        uint256 _poId,
        uint256 _volume
        // uint256 _price - passing in the price is a very 'snarky' thing to do; a regular developer would just get the contract to calculate this.
    ) {

// CALCULATIONS & CHECKS:

  // UNIQUENESS
        require(POs[_poId] == 0, "poId already exists");

  // PO DATA VALIDATION

  // REFER TO EXISTING STATES:
        require(MSAs[_msaId] != 0, "msaId does not exist");

        MSA memory msa = MSAs[_msaId];

  // CHECKS AGAINST EXISTING STATES:
        require(
            msg.sender == msa.buyer,
            "msg.sender not authorised to create a purchase order for this msa"
        );

        require(
            _volume < msa.volumeTierBounds[msa.volumeTierBounds.length - 1] - msa.accumulatedVolumeOrdered,
            "volume ordered exceeds remaining volume permitted under this msa"
        );

  // CALCULATIONS:
        uint _price = calculatePrice(msa.accumulatedVolumeOrdered),

// UPDATE STATES:
        msa.accumulatedVolumeOrdered += _volume;

// STORAGE:
        MSAs[_msaId].accumulatedVolumeOrdered = msa.accumulatedVolumeOrdered;

        delete msa;

        PO memory po;
        po.msaId = _msaId;
        po.volume = _volume;
        po.price = _price;
        po.accumulatedVolumeDelivered = 0;

        POs[_poId] = po;

        delete po;
    }


    function transferNFT (
        uint256 _poId,
        uint256 _invoiceId,
        uint256 _volume,
        uint256 _amountOwed,
        bytes calldata _data
    ) {

        require(Invoices[_invoiceId] == 0, "invoiceId already exists");

        require(POs[_poId] != 0, "poId does not exist");

        PO memory po = POs[_poId];
        MSA memory msa = MSAs[po.msaId];



        require(msg.sender == msa.supplier, "msg.sender not authorised to transfer NFTs for this msa");

        // transfer a certain quantity of the token, according to the msa
        erc1155Contract.safeTransferFrom(msa.supplier, msa.buyer, msa.erc1155TokenType, _quantity, _data);

        require(_amountOwed == calculateAmountOwed(), "amountOwed incorrect");


        Invoice memory invoice;
        invoice.poId = _poId;
        invoice.volume = _volume;
        invoice.amountOwed = _amountOwed;
        invoice.accumulatedAmountPaid = 0;

        Invoices[_invoiceId] = invoice;

        delete invoice;
    }


    function transferFT (uint256 _poId, uint256 _value) {

        require(POs[_poId] != 0, "poId does not exist");

        PO memory po = POs[_poId];
        MSA memory msa = MSAs[po.msaId];

        require(msg.sender == msa.supplier, "msg.sender not authorised to transfer NFTs for this msa");

        // transfer a certain quantity of the token, according to the msa
        erc1155Contract.safeTransferFrom(msa.supplier, msa.buyer, msa.erc1155TokenType, _value, _data);

    }

}
