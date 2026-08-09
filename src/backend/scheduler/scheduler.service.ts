import { dbAsync } from '../config/database';
import { runScheduledScan } from './scan-job';

class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private intervalMinutes: number = 180;
  private isRunning: boolean = false;

  public async init() {
    await this.reloadConfig();
  }

  public async reloadConfig() {
    try {
      const enabledRow = await dbAsync.get("SELECT value FROM settings WHERE key = 'scheduler_enabled'") as any;
      const intervalRow = await dbAsync.get("SELECT value FROM settings WHERE key = 'scheduler_interval'") as any;

      const enabled = enabledRow?.value === '1';
      const interval = parseInt(intervalRow?.value || '180', 10);

      this.intervalMinutes = interval > 0 ? interval : 180;

      if (enabled) {
        this.start();
      } else {
        this.stop();
      }
    } catch (err: any) {
      console.error('[SCHEDULER] Error initializing scheduler config:', err);
    }
  }

  public start() {
    this.stop();
    this.isRunning = true;
    console.log(`[SCHEDULER] Service started. Running scan cycle every ${this.intervalMinutes} minute(s).`);
    
    this.timer = setInterval(() => {
      runScheduledScan();
    }, this.intervalMinutes * 60 * 1000);
  }

  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[SCHEDULER] Service stopped.');
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes
    };
  }
}

export const schedulerService = new SchedulerService();
