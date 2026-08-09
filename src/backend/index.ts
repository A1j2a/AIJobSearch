import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/database.js';
import apiRouter from './routes/api.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize local SQLite database
initDatabase();

// Mount API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start Express server
const HOST = process.env.HOST || '0.0.0.0';
app.listen(Number(PORT), HOST, () => {
  console.log(`\n==================================================`);
  console.log(` 🚀 AI Job Finder Backend API running on http://127.0.0.1:${PORT}`);
  console.log(` 📁 SQLite Database: data/jobsearch.db`);
  console.log(`==================================================\n`);
});

