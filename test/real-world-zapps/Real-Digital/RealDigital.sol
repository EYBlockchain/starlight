// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "./imports/ERC20.sol";
import "./imports/ERC20Burnable.sol";
import "./imports/Pausable.sol";

import "./CBDCAccessControl.sol";

contract RealDigital is ERC20, ERC20Burnable, Pausable, CBDCAccessControl {

    mapping(address => uint256) public frozenBalanceOf;

    event FrozenBalance(address wallet , uint256 amount);

    modifier checkFrozenBalance(address from, uint256 amount) {
        if(frozenBalanceOf[from] > 0)
        require(frozenBalanceOf[from] <= (balanceOf(from) - amount), "RealDigital: minimum balance reached");
        _;
    }

    /**
     * Construtor do token do Real Digital
     * Invoca o construtor do ERC20 e dá permissão de autoridade para a carteira do BCB
     * @param _name Nome do token: Real Digital
     * @param _symbol Símbolo do token: BRL
     * @param _authority Carteira responsavel por emitir, resgatar, mover e congelar fundos (BCB)
     * @param _admin Carteira responsavel por administrar o controle de acessos (BCB)
     */
    constructor(string memory _name, string memory _symbol, address _authority, address _admin)
        ERC20(_name, _symbol)
        CBDCAccessControl(_authority, _admin) {}

    /**
     * Funcão para pausar o token em casos necessarios
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * Funcão para despausar o token em casos necessarios
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * Funcão para emitir tokens para as carteiras permitidas
     * @param to carteira destino
     * @param amount quantidade de tokens
     */
    function mint(address to, uint256 amount)
        public 
        onlyRole(MINTER_ROLE)
    {
        _mint(to, amount);
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount)
        internal
        whenNotPaused
        checkAccess(from, to)
        checkFrozenBalance(from, amount)
        override
    {
        super._beforeTokenTransfer(from, to, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return 2;
    }

    /**
     * Funcão para mover tokens de uma carteira a outra, somente quem possuir M0VER_ROLE pode executar
     * @param from carteira origem
     * @param to carteira destino
     * @param amount quantidade de tokens
     */
    function move(address from, address to, uint256 amount) public onlyRole(MOVER_ROLE) {
        _transfer(from, to, amount);
    }

    /**
     * Funcão para incrementar tokens parcialmente  bloqueados de uma carteira, somente quem possuir FREEZER_ROLE pode executar
     * @param from carteira origem
     * @param amount quantidade de tokens
     */
    function increaseFrozenBalance(address from, uint256 amount) public onlyRole(FREEZER_ROLE) {
        require(from!= address(0), "RealDigital: address cannot be zero");
        frozenBalanceOf[from] += amount;
        emit FrozenBalance(from, frozenBalanceOf[from]);
    }

    /**
     * Funcão para decrementar tokens parcialmente  bloqueados de uma carteira, somente quem possuir FREEZER_ROLE pode executar
     * @param from carteira origem
     * @param amount quantidade de tokens
     */
    function decreaseFrozenBalance(address from, uint256 amount) public onlyRole(FREEZER_ROLE) {
        require(from!= address(0), "RealDigital: address cannot be zero");
        require(frozenBalanceOf[from] >= amount, "RealDigital: Frozen Balance is less than amount");
        frozenBalanceOf[from] -= amount;
        emit FrozenBalance(from, frozenBalanceOf[from]);
    }

    function burn (uint256 amount) public override onlyRole(BURNER_ROLE) {
        _burn(msg.sender, amount);
    }

    /**
     * Funcão para queimar tokens de uma carteira, somente quem possuir M0VER_ROLE pode executar
     * @param from carteira origem
     * @param amount quantidade de tokens
     */
    function moveAndBurn(address from, uint256 amount) public onlyRole(MOVER_ROLE) {
        _burn(from, amount);
    }

    function burnFrom(address account, uint256 amount) override public onlyRole(BURNER_ROLE) {
        super.burnFrom(account, amount);
    }
}