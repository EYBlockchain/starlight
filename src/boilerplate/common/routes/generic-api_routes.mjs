import express from 'express';
import {service_FUNCTION_NAME} from "./api_services.mjs";
const router  = express.Router();

//router.get('/database', serviceController.getAllCommitment);
router.post('/FUNCTION_NAME', service_FUNCTION_NAME);
