import { service_add } from "./api_services.mjs";

import { service_remove } from "./api_services.mjs";

import { service_addPublic } from "./api_services.mjs";

import { service_terminateContract } from "./api_services.mjs";

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
router.post("/add", service_add);

// eslint-disable-next-line func-names
router.post("/remove", service_remove);

// eslint-disable-next-line func-names
router.post("/addPublic", service_addPublic);

// eslint-disable-next-line func-names
router.post("/terminateContract", service_terminateContract);

// commitment getter routes
router.get("/getAllCommitments", service_allCommitments);
router.get("/getCommitmentsByVariableName", service_getCommitmentsByState);
router.get("/getBalance", service_getBalance);
router.get("/getBalanceByState", service_getBalanceByState);
// nullifier route
router.post("/reinstateNullifiers", service_reinstateNullifiers);
router.post("/getSharedKeys", service_getSharedKeys);

export default router;
