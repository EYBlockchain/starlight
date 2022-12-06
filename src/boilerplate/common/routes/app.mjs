import express from 'express';
import { addservice, removeservice} from "../services/api.mjs";
const router  = express.Router();

//router.get('/database', serviceController.getAllCommitment);
router.post('/add', addservice);
router.post('/remove', removeservice);

export default router;
