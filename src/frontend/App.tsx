import React, { useEffect, useState } from 'react';
import { Sidebar, PageId } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { ProfilePage } from './pages/ProfilePage';
import { SearchConfigPage } from './pages/SearchConfigPage';
import { SettingsPage } from './pages/SettingsPage';
import { JobsPage } from './pages/JobsPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { ScannerPage } from './pages/ScannerPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { LogsPage } from './pages/LogsPage';
import { UserProfile } from '../shared/types';
import { fetchProfile, testOllama } from './api';

export const App: React.FC = () => {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<boolean>(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const profileData = await fetchProfile();
      setProfile(profileData);
    } catch (e) {
      console.warn('Initial profile load warning:', e);
    }

    try {
      const ollamaRes = await testOllama();
      setOllamaStatus(ollamaRes.available);
    } catch (e) {
      setOllamaStatus(false);
    }
  };

  const handleStartScan = () => {
    setActivePage('scanner');
  };

  const handleNavigateToJobDetail = (jobId: number) => {
    setSelectedJobId(jobId);
  };

  return (
    <div className="app-layout">
      <Sidebar activePage={activePage} onSelectPage={(page) => {
        setSelectedJobId(null);
        setActivePage(page);
      }} />

      <div className="main-content">
        <Header
          profile={profile}
          ollamaStatus={ollamaStatus}
          onStartScan={handleStartScan}
        />

        {selectedJobId !== null ? (
          <JobDetailPage
            jobId={selectedJobId}
            onBack={() => setSelectedJobId(null)}
          />
        ) : (
          <>
            {activePage === 'dashboard' && (
              <Dashboard
                onNavigateToScanner={() => setActivePage('scanner')}
                onNavigateToJobDetail={handleNavigateToJobDetail}
              />
            )}

            {activePage === 'resume' && (
              <ProfilePage onProfileUpdated={(p) => setProfile(p)} />
            )}

            {activePage === 'search' && (
              <SearchConfigPage />
            )}

            {activePage === 'settings' && (
              <SettingsPage />
            )}

            {activePage === 'jobs' && (
              <JobsPage />
            )}

            {activePage === 'saved' && (
              <ApplicationsPage onNavigateToJobDetail={handleNavigateToJobDetail} />
            )}

            {activePage === 'applications' && (
              <ApplicationsPage onNavigateToJobDetail={handleNavigateToJobDetail} />
            )}

            {activePage === 'scanner' && (
              <ScannerPage onScanCompleted={() => console.log('Real Scan completed!')} />
            )}

            {activePage === 'analytics' && (
              <div className="page-container">
                <div className="page-title-section">
                  <h1 className="page-title">Analytics & Skill Gaps</h1>
                </div>
                <div className="card">
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Analytics dashboard visualizes top requested technical skills in your target market and identifies missing skill gaps. (Phase 7)
                  </p>
                </div>
              </div>
            )}

            {activePage === 'logs' && (
              <LogsPage />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
