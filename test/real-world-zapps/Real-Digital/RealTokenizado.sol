// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./RealDigital.sol";

/**
 * Implementação do contrato do Real Tokenizado (DVt e MEt)
 *
 * Este contrato herda do Real Digital e todas as funcoes implementadas
 * 
 */

contract RealTokenizado is RealDigital {
    /**
     * _String_ que representa o nome do participante
     * _Uitn256_ que representa o numero da instituição
    */
    
    string  public participant;
    uint256 public cnpj8;
    address public reserve;

    /**
     * Construtor do token do Real Tokenizado
     * Invoca o construtor do ERC20 e dá permissão de autoridade para a carteira do BCB
     * @param _name Nome do token: Real Tokenizado (Instituiçâo)
     * @param _symbol Símbolo do token: BRL
     * @param _authority Carteira responsavel por emitir, resgatar, mover e congelar fundos (BCB)
     * @param _admin Carteira responsavel por administrar o controle de acessos (BCB)
     * @param _participant Identificação do participante como string.
     * @param _cnpj8 Primeiros 8 digitos do cnpj da instituição
     * @param _reserve Carteira de reserva da Instituição
    */

    constructor(string memory _name, string memory _symbol, address _authority, address _admin,
        string memory _participant, uint256 _cnpj8, address _reserve) 
        RealDigital(_name, _symbol, _authority, _admin) 
    {
        require(_reserve!= address(0),  "RealTokenizado: Receiver cannot be address zero");
        participant =_participant;
        cnpj8 = _cnpj8;
        reserve = _reserve;
    }

    /**
     * Função para atualizar a reserva do token, a reserva é usada pelo DvP
     * @param newReserve Carteira da autoridade (Instituição)
    */
    function updateReserve (address newReserve) public onlyRole(ACCESS_ROLE) {
        require(newReserve!= address(0),  "RealTokenizado: Receiver cannot be address zero");
        reserve = newReserve;
    }
}