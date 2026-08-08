import { db } from '../config/database.js';

export async function runScheduledScan(): Promise<{ jobsFound: number; jobsAnalyzed: number }> {
  console.log(`[SCHEDULER] Triggering scheduled job scan at ${new Date().toISOString()}`);

  db.prepare(`
    INSERT INTO logs (component, event, status, message)
    VALUES (?, ?, ?, ?)
  `).run('SCHEDULER', 'SCAN_RUN', 'INFO', 'Background job scan cycle initiated.');

  // In Phase 4, this will trigger the JobSource aggregator & Ollama analyzer
  return { jobsFound: 0, jobsAnalyzed: 0 };
}
