import { Router, Request, Response } from 'express';
import { getProfile, updateProfile, getResumeVersions, selectResumeVersion, createResumeVersion } from '../controllers/profile';
import { getSearchConfig, updateSearchConfig } from '../controllers/search';
import { getSettings, updateSettings, testClusterConnection } from '../controllers/settings';
import { getJobs, getJobById, triggerSeedDemoJobs, analyzeJob, getDashboardStats, getLogs, clearLogs, updateApplicationStatus, getApplications } from '../controllers/jobs';
import { scannerService } from '../services/scanner.service';

const router = Router();

// Helper to register routes on both root path and /api prefix
function addGet(path: string, handler: any) {
  router.get(path, handler);
  router.get('/api' + path, handler);
}
function addPost(path: string, handler: any) {
  router.post(path, handler);
  router.post('/api' + path, handler);
}
function addPut(path: string, handler: any) {
  router.put(path, handler);
  router.put('/api' + path, handler);
}
function addDelete(path: string, handler: any) {
  router.delete(path, handler);
  router.delete('/api' + path, handler);
}

// Profile & Resume Versioning endpoints
addGet('/profile', getProfile);
addPut('/profile', updateProfile);
addGet('/resumes', getResumeVersions);
addPost('/resumes/select', selectResumeVersion);
addPost('/resumes/create', createResumeVersion);

// Search configuration endpoints
addGet('/search-config', getSearchConfig);
addPut('/search-config', updateSearchConfig);

// Settings endpoints
addGet('/settings', getSettings);
addPut('/settings', updateSettings);
addPost('/settings/test-cluster', testClusterConnection);

// Job & Dashboard endpoints
addGet('/jobs', getJobs);
addPost('/jobs/seed-demo', triggerSeedDemoJobs);
addGet('/jobs/:id', getJobById);
addPost('/jobs/:id/analyze', analyzeJob);
addGet('/dashboard/stats', getDashboardStats);

// Application Tracker Board endpoints
addGet('/applications', getApplications);
addPost('/applications/update', updateApplicationStatus);

// Scanner Engine endpoints
const startScannerHandler = (req: Request, res: Response) => {
  scannerService.executeRealJobScan().catch(err => console.error('[SCANNER_BG_ERR]', err));
  res.json({ success: true, message: 'Real job scan launched in background.' });
};
addPost('/scanner/start', startScannerHandler);

const stopScannerHandler = async (req: Request, res: Response) => {
  const result = await scannerService.stopScan();
  res.json(result);
};
addPost('/scanner/stop', stopScannerHandler);

const reanalyzeHandler = (req: Request, res: Response) => {
  scannerService.reanalyzeAllJobs().catch(err => console.error('[REANALYZE_BG_ERR]', err));
  res.json({ success: true, message: 'Re-analysis of all jobs launched in background.' });
};
addPost('/scanner/reanalyze', reanalyzeHandler);

const scannerStatusHandler = async (req: Request, res: Response) => {
  const status = await scannerService.getStatus();
  res.json(status);
};
addGet('/scanner/status', scannerStatusHandler);

// System Logs endpoints
addGet('/logs', getLogs);
addDelete('/logs', clearLogs);

export default router;
