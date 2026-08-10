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
        // Don't crash cold-start completely, allow retries on next request
      });
  }
  await dbInitPromise;
}

// Middleware: ensure DB is ready before routing
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const isHealth = req.path.includes('/health') || req.url.includes('/health');
  if (isHealth) return next();
  try {
    await ensureDbReady();
    next();
  } catch (err: any) {
    console.error('[API MIDDLEWARE ERROR]', err);
    next(); // Fallthrough to route handler which has fallback handling
  }
});

const healthHandler = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    dbReady,
    isVercel: Boolean(process.env.VERCEL || process.env.USE_TURSO || process.env.NODE_ENV === 'production'),
    timestamp: new Date().toISOString()
  });
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// Mount API Router directly
app.use(apiRouter);

// 404 Fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error', details: String(err) });
});

export default app;
