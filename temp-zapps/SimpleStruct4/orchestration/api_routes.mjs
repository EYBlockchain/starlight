import { service_addPO } from "./api_services.mjs";

import { service_addInvoice } from "./api_services.mjs";

import { service_pay } from "./api_services.mjs";

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
router.post("/addPO", service_addPO);

// eslint-disable-next-line func-names
router.post("/addInvoice", service_addInvoice);

// eslint-disable-next-line func-names
router.post("/pay", service_pay);

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
