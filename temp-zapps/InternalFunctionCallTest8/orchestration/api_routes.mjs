import { service_addB } from "./api_services.mjs";

import { service_addA } from "./api_services.mjs";

import { service_remove3 } from "./api_services.mjs";

import { service_remove4 } from "./api_services.mjs";

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
router.post("/addB", service_addB);

// eslint-disable-next-line func-names
router.post("/addA", service_addA);

// eslint-disable-next-line func-names
router.post("/remove3", service_remove3);

// eslint-disable-next-line func-names
router.post("/remove4", service_remove4);

// commitment getter routes
router.get("/getAllCommitments", service_allCommitments);
router.get("/getCommitmentsByVariableName", service_getCommitmentsByState);
router.get("/getBalance", service_getBalance);
router.get("/getBalanceByState", service_getBalanceByState);
// nullifier route
router.post("/reinstateNullifiers", service_reinstateNullifiers);
router.post("/getSharedKeys", service_getSharedKeys);

export default router;
