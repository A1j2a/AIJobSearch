import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vercel Serverless Function is working!' });
});

app.get('/api/debug-import', async (req, res) => {
  try {
    console.log('Testing dynamic imports...');
    const dbModule = await import('../src/backend/config/database');
    const profileModule = await import('../src/backend/controllers/profile');
    const jobsModule = await import('../src/backend/controllers/jobs');
    const scannerModule = await import('../src/backend/services/scanner.service');
    const apiRouterModule = await import('../src/backend/routes/api');

    res.json({
      dbOk: Boolean(dbModule.dbAsync),
      profileOk: Boolean(profileModule.getProfile),
      jobsOk: Boolean(jobsModule.getJobs),
      scannerOk: Boolean(scannerModule.scannerService),
      apiRouterOk: Boolean(apiRouterModule.default)
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, name: err.name, stack: err.stack });
  }
});

export default app;
