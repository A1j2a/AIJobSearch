import { dbAsync } from '../config/database';

export async function runScheduledScan(): Promise<{ jobsFound: number; jobsAnalyzed: number }> {
  console.log(`[SCHEDULER] Triggering scheduled job scan at ${new Date().toISOString()}`);

  try {
    await dbAsync.run(`
      INSERT INTO logs (component, event, status, message)
      VALUES (?, ?, ?, ?)
    `, ['SCHEDULER', 'SCAN_RUN', 'INFO', 'Background job scan cycle initiated.']);
  } catch (e) {}

  return { jobsFound: 0, jobsAnalyzed: 0 };
}
