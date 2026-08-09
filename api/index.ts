import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initDatabase } from '../src/backend/config/database';
import apiRouter from '../src/backend/routes/api';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Lazy Database Initialization
let dbReady = false;
let dbInitPromise: Promise<void> | null = null;

async function ensureDbReady(): Promise<void> {
  if (dbReady) return;
  if (!dbInitPromise) {
    dbInitPromise = initDatabase()
      .then(() => {
        dbReady = true;
        console.log('[API] DB init successful');
      })
      .catch((err) => {
        console.error('[API] DB init failed:', err);
        dbInitPromise = null;
        throw err;
      });
  }
  await dbInitPromise;
}

// Middleware: ensure DB is ready before routing
app.use(async (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/api/health') return next();
  try {
    await ensureDbReady();
    next();
  } catch (err: any) {
    return res.status(503).json({
      error: 'Database connection failed',
      details: err.message || String(err)
    });
  }
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    dbReady,
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
