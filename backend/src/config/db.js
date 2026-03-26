import mongoose from 'mongoose';

/**
 * @param {string} uri
 */
export async function connectMongo(uri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8_000,
  });
}
