import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from '../src/backend/config/database.js';
import apiRouter from '../src/backend/routes/api.js';

const app = express();

app.use(cors());
app.use(express.json());

// Initialize Database
initDatabase();

// Mount API Routes
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
