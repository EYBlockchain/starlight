import express from 'express';
import {service_FUNCTION_NAME} from "./api_services.mjs";

export class Router {
    constructor(serviceMgr){
        this.serviceMgr =serviceMgr;
    }

    addRoutes() {

        const router  = express.Router();

//router.get('/database', serviceController.getAllCommitment);
router.post('/FUNCTION_NAME', this.serviceMgr.service_FUNCTION_NAME.bind(this.serviceMgr),);

    }
}

