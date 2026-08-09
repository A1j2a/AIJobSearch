import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { initDatabase } from '../src/backend/config/database.js';
import apiRouter from '../src/backend/routes/api.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Database synchronously (libsql sync API)
try {
  initDatabase();
} catch (err) {
  console.error('[API] FATAL: DB init failed:', err);
}

// Mount API Routes
app.use('/api', apiRouter);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;
