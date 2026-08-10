import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { initDatabase } from '../src/backend/config/database';
import apiRouter from '../src/backend/routes/api';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Lazy DB initialization in background on boot
initDatabase().catch(err => console.error('[API Cold Start DB Error]', err));

const healthHandler = (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    isVercel: Boolean(process.env.VERCEL || process.env.USE_TURSO || process.env.NODE_ENV === 'production'),
    timestamp: new Date().toISOString()
  });
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

// Mount API Router on both /api prefix and root
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 404 Fallback
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[API ERROR]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error', details: String(err) });
});

module.exports = app;
module.exports.default = app;
export default app;
