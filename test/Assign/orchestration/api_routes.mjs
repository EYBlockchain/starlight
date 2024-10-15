import {
	service_allCommitments,
	service_getCommitmentsByState,
	service_reinstateNullifiers,
	service_getSharedKeys,
	service_getBalance,
	service_getBalanceByState,
	service_backupData,
} from "./api_services.mjs";

import express from "express";

export class Router {
	constructor(serviceMgr) {
		this.serviceMgr = serviceMgr;
	}
	addRoutes() {
		const router = express.Router();

		router.post("/add", this.serviceMgr.service_add.bind(this.serviceMgr));

		router.post(
			"/remove",
			this.serviceMgr.service_remove.bind(this.serviceMgr)
		);

		// commitment getter routes
		router.get("/getAllCommitments", service_allCommitments);
		router.get("/getCommitmentsByVariableName", service_getCommitmentsByState);
		router.get("/getBalance", service_getBalance);
		router.get("/getBalanceByState", service_getBalanceByState);
		// nullifier route
		router.post("/reinstateNullifiers", service_reinstateNullifiers);
		router.post("/getSharedKeys", service_getSharedKeys);
		// backup route
		router.post("/backupDataRetriever", service_backupData);

		return router;
	}
}
