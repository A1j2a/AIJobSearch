import { Router } from 'express';
import { getProfile, updateProfile, getResumeVersions, selectResumeVersion, createResumeVersion } from '../controllers/profile';
import { getSearchConfig, updateSearchConfig } from '../controllers/search';
import { getSettings, updateSettings, testClusterConnection } from '../controllers/settings';
import { getJobs, getJobById, triggerSeedDemoJobs, analyzeJob, getDashboardStats, getLogs, clearLogs, updateApplicationStatus, getApplications } from '../controllers/jobs';
import { scannerService } from '../services/scanner.service';

const router = Router();

// Profile & Resume Versioning endpoints
router.get(['/profile', '/api/profile'], getProfile);
router.put(['/profile', '/api/profile'], updateProfile);
router.get(['/resumes', '/api/resumes'], getResumeVersions);
router.post(['/resumes/select', '/api/resumes/select'], selectResumeVersion);
router.post(['/resumes/create', '/api/resumes/create'], createResumeVersion);

// Search configuration endpoints
router.get(['/search-config', '/api/search-config'], getSearchConfig);
router.put(['/search-config', '/api/search-config'], updateSearchConfig);

// Settings endpoints
router.get(['/settings', '/api/settings'], getSettings);
router.put(['/settings', '/api/settings'], updateSettings);
router.post(['/settings/test-cluster', '/api/settings/test-cluster'], testClusterConnection);

// Job & Dashboard endpoints
router.get(['/jobs', '/api/jobs'], getJobs);
router.post(['/jobs/seed-demo', '/api/jobs/seed-demo'], triggerSeedDemoJobs);
router.get(['/jobs/:id', '/api/jobs/:id'], getJobById);
router.post(['/jobs/:id/analyze', '/api/jobs/:id/analyze'], analyzeJob);
router.get(['/dashboard/stats', '/api/dashboard/stats'], getDashboardStats);

// Application Tracker Board endpoints
router.get(['/applications', '/api/applications'], getApplications);
router.post(['/applications/update', '/api/applications/update'], updateApplicationStatus);

// Scanner Engine endpoints
router.post(['/scanner/start', '/api/scanner/start'], (req, res) => {
  scannerService.executeRealJobScan().catch(err => console.error('[SCANNER_BG_ERR]', err));
  res.json({ success: true, message: 'Real job scan launched in background.' });
});

router.post(['/scanner/stop', '/api/scanner/stop'], async (req, res) => {
  const result = await scannerService.stopScan();
  res.json(result);
});

router.post(['/scanner/reanalyze', '/api/scanner/reanalyze'], (req, res) => {
  scannerService.reanalyzeAllJobs().catch(err => console.error('[REANALYZE_BG_ERR]', err));
  res.json({ success: true, message: 'Re-analysis of all jobs launched in background.' });
});

router.get(['/scanner/status', '/api/scanner/status'], async (req, res) => {
  const status = await scannerService.getStatus();
  res.json(status);
});

// System Logs endpoints
router.get(['/logs', '/api/logs'], getLogs);
router.delete(['/logs', '/api/logs'], clearLogs);

export default router;
