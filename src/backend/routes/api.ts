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
router.post('/scanner/start', async (req, res) => {
  scannerService.executeRealJobScan();
  res.json({ success: true, message: 'Real job scan launched in background.' });
});

router.post('/scanner/stop', (req, res) => {
  const result = scannerService.stopScan();
  res.json(result);
});

router.post('/scanner/reanalyze', async (req, res) => {
  try {
    scannerService.reanalyzeAllJobs();
    res.json({ success: true, message: 'Re-analysis of all jobs launched in background.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/scanner/status', (req, res) => {
  res.json(scannerService.getStatus());
});

// System Logs endpoints
router.get('/logs', getLogs);
router.delete('/logs', clearLogs);

export default router;
