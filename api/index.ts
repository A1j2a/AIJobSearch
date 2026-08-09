import express from 'express';

const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Vercel Serverless Function is working!' });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const { createClient } = await import('@libsql/client');
    const client = createClient({
      url: 'https://jobsearchwithai-ajpatidar.aws-ap-south-1.turso.io',
      authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODYyNzM5NjQsImlkIjoiMDE5ZmU2MzktODEwMS03ZGMwLTky0QtODU2NDg0ODk0NTFiIiwia2lkIjoiQUt2ZFl6V1JyN0JvWk1rT3FsV1FhVGZMaVMtR1V6M25tN1hqemVRYkhmTSIsInJpZCI6IjM1YzdjYjgzLWRjNGYtNDcyNS1hYjhkLTIwYWE5NjhhMjcyOSJ9.t01F47t7FziCu8GhBzwd5IPgrmK1dcMr5CK-2GdR2TnlBN3vq1ei_8d2SQRvlYyLqt6yGS-0lRJCgkv4gyOYAg'
    });
    const result = await client.execute('SELECT 1 as test');
    res.json({ success: true, rows: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export default app;
