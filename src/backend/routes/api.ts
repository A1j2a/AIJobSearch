import { Router } from 'express';
import { getProfile, updateProfile, getResumeVersions, selectResumeVersion, createResumeVersion } from '../controllers/profile.js';
import { getSearchConfig, updateSearchConfig } from '../controllers/search.js';
import { getSettings, updateSettings, testClusterConnection } from '../controllers/settings.js';
import { getJobs, getJobById, triggerSeedDemoJobs, analyzeJob, getDashboardStats, getLogs, clearLogs, updateApplicationStatus, getApplications } from '../controllers/jobs.js';
import { scannerService } from '../services/scanner.service.js';

const router = Router();

// Profile & Resume Versioning endpoints
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/resumes', getResumeVersions);
router.post('/resumes/select', selectResumeVersion);
router.post('/resumes/create', createResumeVersion);

// Search configuration endpoints
router.get('/search-config', getSearchConfig);
router.put('/search-config', updateSearchConfig);

// Settings endpoints
router.get('/settings', getSettings);
router.put('/settings', updateSettings);
router.post('/settings/test-cluster', testClusterConnection);

// Job & Dashboard endpoints
router.get('/jobs', getJobs);
router.post('/jobs/seed-demo', triggerSeedDemoJobs);
router.get('/jobs/:id', getJobById);
router.post('/jobs/:id/analyze', analyzeJob);
router.get('/dashboard/stats', getDashboardStats);

// Application Tracker Board endpoints
router.get('/applications', getApplications);
router.post('/applications/update', updateApplicationStatus);

// Scanner Engine endpoints
router.post('/scanner/start', (req, res) => {
  scannerService.executeRealJobScan().catch(err => console.error('[SCANNER_BG_ERR]', err));
  res.json({ success: true, message: 'Real job scan launched in background.' });
});

router.post('/scanner/stop', async (req, res) => {
  const result = await scannerService.stopScan();
  res.json(result);
});

router.post('/scanner/reanalyze', (req, res) => {
  scannerService.reanalyzeAllJobs().catch(err => console.error('[REANALYZE_BG_ERR]', err));
  res.json({ success: true, message: 'Re-analysis of all jobs launched in background.' });
});

router.get('/scanner/status', async (req, res) => {
  const status = await scannerService.getStatus();
  res.json(status);
});

// System Logs endpoints
router.get('/logs', getLogs);
router.delete('/logs', clearLogs);

export default router;
