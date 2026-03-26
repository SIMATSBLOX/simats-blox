import mongoose from 'mongoose';

export const SENSOR_TYPES = [
  'dht11',
  'soil_moisture',
  'ultrasonic',
  'ir_sensor',
  'lm35',
];

const deviceSchema = new mongoose.Schema(
  {
    ownerUserId: { type: String, required: true, trim: true, index: true },
    deviceId: { type: String, required: true, unique: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    sensorType: {
      type: String,
      required: true,
      enum: SENSOR_TYPES,
    },
    location: { type: String, default: '', trim: true },
    apiKey: { type: String, required: true },
    status: { type: String, enum: ['online', 'offline'], default: 'offline' },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);
