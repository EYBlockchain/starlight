import express from 'express';

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

