import Web3 from "web3";
import config from "config";

import logger from "./logger.mjs";

export default {
	connection() {
		if (!this.web3) this.connect();
		return this.web3;
	},

	/**
	 * Connects to web3 and then sets proper handlers for events
	 */
	connect() {
		if (this.web3) return this.web3.currentProvider;

		logger.http("Blockchain Connecting ...");
		const provider = new Web3.providers.WebsocketProvider(
			config.web3.url,
			null,
			config.web3.options
		);

		provider.on("error", console.error);
		provider.on("connect", () => logger.http("Blockchain Connected ..."));
		provider.on("end", console.error);

		this.web3 = new Web3(provider);

		return provider;
	},

	/**
	 * Checks the status of connection
	 *
	 * @return {Boolean} - Resolves to true or false
	 */
	isConnected() {
		if (this.web3) {
			return this.web3.eth.net.isListening();
		}
		return false;
	},
};
