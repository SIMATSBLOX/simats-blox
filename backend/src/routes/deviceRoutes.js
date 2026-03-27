import express from 'express';
import * as deviceController from '../controllers/deviceController.js';
import { authUserJwt } from '../middleware/authUser.js';

const router = express.Router();

router.post('/devices', authUserJwt, (req, res) => deviceController.registerDevice(req, res));
router.get('/devices', authUserJwt, (req, res) => deviceController.listDevices(req, res));
router.get('/devices/:deviceId/latest', authUserJwt, (req, res) => deviceController.getLatestForDevice(req, res));
router.get('/devices/:deviceId/history', authUserJwt, (req, res) => deviceController.getHistory(req, res));
router.delete('/devices/:deviceId', authUserJwt, (req, res) => deviceController.deleteDevice(req, res));

export default router;
