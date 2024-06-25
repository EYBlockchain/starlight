import { service_assign } from "./api_services.mjs";

import { service_decra } from "./api_services.mjs";

import { service_decrb } from "./api_services.mjs";

import { service_incra } from "./api_services.mjs";

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
router.post("/assign", service_assign);

// eslint-disable-next-line func-names
router.post("/decra", service_decra);

// eslint-disable-next-line func-names
router.post("/decrb", service_decrb);

// eslint-disable-next-line func-names
router.post("/incra", service_incra);

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
