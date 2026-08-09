import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initDatabase } from '../src/backend/config/database';
import apiRouter from '../src/backend/routes/api';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Database asynchronously
let dbReady = false;
let dbError: Error | null = null;

const dbInitPromise = initDatabase()
  .then(() => { dbReady = true; console.log('[API] DB init successful'); })
  .catch((err) => { dbError = err; console.error('[API] DB init failed:', err); });

// Middleware: ensure DB is ready before routing
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (!dbReady) {
    try {
      await dbInitPromise;
    } catch (e: any) {
      dbError = e;
    }
  }
  if (dbError && !dbReady) {
    return res.status(503).json({ error: 'Database initialization failed', details: String(dbError) });
  }
  next();
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    dbReady,
    dbError: dbError ? String(dbError) : null,
    isVercel: Boolean(process.env.VERCEL || process.env.USE_TURSO),
    timestamp: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error', details: String(err) });
});

export default app;
