/**
 * server.js — News Pulse API entry point.
 * Connects to MongoDB then starts Express.
 */

require('dotenv').config();
const app = require('./src/app');
const { connectDB } = require('./src/db/database');

const PORT = parseInt(process.env.PORT || '5000', 10);

async function start() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`\n🚀  News Pulse API running on http://localhost:${PORT}`);
      console.log(`   Health: http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
