// web3.mjs
import Web3 from "web3";
import config from "config";
import logger from "./logger.mjs";

class Web3Service {
	constructor() {
		this.web3 = null;
		this.provider = null;
		this.reconnectInterval = 5000;
		this.connect();
	}

	connect() {
		if (!this.web3) {
			logger.http("Blockchain Connecting ...");
			this.provider = new Web3.providers.WebsocketProvider(
				config.web3.url,
				config.web3.options
			);

			this.provider.on("error", (error) => {
				console.error("Websocket connection error:", error);
				this.reconnect();
			});

			this.provider.on("connect", () => {
				logger.http("Blockchain Connected ...");
			});

			this.provider.on("end", (event) => {
				console.error("Websocket connection ended:", event);
				this.reconnect();
			});

			this.web3 = new Web3(this.provider);
		}
	}

	reconnect() {
		logger.http("Attempting to reconnect...");
		if (this.provider) {
			this.provider.disconnect(1000, "Reconnecting");
		}
		setTimeout(() => {
			this.connect();
		}, this.reconnectInterval);
	}

	getConnection() {
		if (!this.web3 || !this.provider.connected) {
			this.connect();
		}
		return this.web3;
	}

	async isConnected() {
		if (this.web3) {
			try {
				return await this.web3.eth.net.isListening();
			} catch (error) {
				console.error("Web3 isConnected check failed:", error);
				this.reconnect();
				return false;
			}
		}
		return false;
	}
}

const web3Instance = new Web3Service();
export default web3Instance;
