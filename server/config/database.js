'use strict';

const mongoose = require('mongoose');

let isConnected = false;
let mongoServer = null;

/**
 * Connect to MongoDB URI or fallback to In-Memory MongoDB Server.
 */
async function connectDatabase() {
  if (isConnected) {
    console.log('↩  MongoDB already connected — reusing existing connection.');
    return;
  }

  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      const dbName = process.env.DATABASE_NAME || 'smart_grievance';
      await mongoose.connect(uri, {
        dbName,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 3000,
        socketTimeoutMS: 45000,
      });

      isConnected = true;
      const host = mongoose.connection.host;
      console.log(`✅  MongoDB connected: ${host} (db: ${dbName})`);

      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
        isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠  MongoDB disconnected — will attempt reconnect on next request.');
        isConnected = false;
      });
      return;
    } catch (err) {
      console.warn(`⚠️  Could not connect to MongoDB URI (${err.message}).`);
    }
  }

  // Fallback: Use mongodb-memory-server if available
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    console.log('📦  Starting In-Memory MongoDB Server (No local MongoDB installation required)...');
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    await mongoose.connect(mongoUri, {
      dbName: 'smart_grievance',
    });

    isConnected = true;
    console.log('✅  In-Memory MongoDB started and connected successfully!');

    // Auto-seed in-memory database
    try {
      const { seed } = require('../scripts/seed');
      console.log('🌱  Auto-seeding initial database data...');
      await seed(false);
    } catch (seedErr) {
      console.warn('⚠️  Auto-seed skipped or failed:', seedErr.message);
    }
  } catch (err) {
    console.warn(`⚠️  In-Memory MongoDB fallback unavailable (${err.message}). Backend will run in standalone mode.`);
  }
}

module.exports = { connectDatabase };
