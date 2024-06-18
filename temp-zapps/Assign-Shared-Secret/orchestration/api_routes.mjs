import { service_deposit } from "./api_services.mjs";

import { service_startSwap } from "./api_services.mjs";

import { service_completeSwap } from "./api_services.mjs";

import { service_quitSwap } from "./api_services.mjs";

import {
	service_allCommitments,
	service_getCommitmentsByState,
	service_reinstateNullifiers,
	service_getSharedKeys,
	service_getBalance,
	service_getBalanceByState,
} from "./api_services.mjs";

import express from "express";

const router = express.Router();

// eslint-disable-next-line func-names
router.post("/deposit", service_deposit);

// eslint-disable-next-line func-names
router.post("/startSwap", service_startSwap);

// eslint-disable-next-line func-names
router.post("/completeSwap", service_completeSwap);

// eslint-disable-next-line func-names
router.post("/quitSwap", service_quitSwap);

// commitment getter routes
router.get("/getAllCommitments", service_allCommitments);
router.get("/getCommitmentsByVariableName", service_getCommitmentsByState);
router.get("/getBalance", service_getBalance);
router.get("/getBalanceByState", service_getBalanceByState);
// nullifier route
router.post("/reinstateNullifiers", service_reinstateNullifiers);
router.post("/getSharedKeys", service_getSharedKeys);

export default router;
