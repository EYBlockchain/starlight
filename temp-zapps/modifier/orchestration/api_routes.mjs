import { service_alpha } from "./api_services.mjs";

import { service_beta } from "./api_services.mjs";

import { service_gamma } from "./api_services.mjs";

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
router.post("/alpha", service_alpha);

// eslint-disable-next-line func-names
router.post("/beta", service_beta);

// eslint-disable-next-line func-names
router.post("/gamma", service_gamma);

// commitment getter routes
router.get("/getAllCommitments", service_allCommitments);
router.get("/getCommitmentsByVariableName", service_getCommitmentsByState);
router.get("/getBalance", service_getBalance);
router.get("/getBalanceByState", service_getBalanceByState);
// nullifier route
router.post("/reinstateNullifiers", service_reinstateNullifiers);
router.post("/getSharedKeys", service_getSharedKeys);
router.post("/getSharedKeys", service_getSharedKeys);

export default router;
