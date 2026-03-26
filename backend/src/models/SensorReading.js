import mongoose from 'mongoose';
import { SENSOR_TYPES } from './Device.js';

const sensorReadingSchema = new mongoose.Schema(
  {
    ownerUserId: { type: String, required: true, trim: true, index: true },
    deviceId: { type: String, required: true, index: true, trim: true },
    sensorType: { type: String, required: true, enum: SENSOR_TYPES },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    strict: true,
  },
);

sensorReadingSchema.index({ deviceId: 1, createdAt: -1 });
sensorReadingSchema.index({ ownerUserId: 1, deviceId: 1, createdAt: -1 });

export const SensorReading =
  mongoose.models.SensorReading || mongoose.model('SensorReading', sensorReadingSchema);
