import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initDatabase } from './config/database';
import apiRouter from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Mount API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server when executed directly (Standalone Dev Mode)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const HOST = process.env.HOST || '0.0.0.0';
  app.listen(Number(PORT), HOST, () => {
    console.log(`\n==================================================`);
    console.log(` 🚀 AI Job Finder Backend API running on http://127.0.0.1:${PORT}`);
    console.log(`==================================================\n`);
  });
}

export default app;
