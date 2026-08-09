import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initDatabase } from '../src/backend/config/database.js';
import apiRouter from '../src/backend/routes/api.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Database asynchronously
let dbReady = false;
let dbError: Error | null = null;

const dbInitPromise = initDatabase()
  .then(() => { dbReady = true; })
  .catch((err) => { dbError = err; console.error('[API] DB init failed:', err); });

// Middleware: ensure DB is ready before routing
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (!dbReady) {
    await dbInitPromise;
  }
  if (dbError && !dbReady) {
    return res.status(503).json({ error: 'Database initialization failed', details: String(dbError) });
  }
  next();
});

// Mount API Routes
app.use('/api', apiRouter);

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', db: dbReady ? 'ready' : 'initializing', timestamp: new Date().toISOString() });
});

export default app;
