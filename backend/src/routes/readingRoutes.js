import express from 'express';
import { authDevice } from '../middleware/authDevice.js';
import * as readingController from '../controllers/readingController.js';

const router = express.Router();

router.post('/readings', authDevice, (req, res) => readingController.receiveReading(req, res));

export default router;
