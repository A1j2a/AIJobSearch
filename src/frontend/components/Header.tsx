import React from 'react';
import { Database, Cpu, Play } from 'lucide-react';
import { UserProfile } from '../../shared/types';

interface HeaderProps {
  profile: UserProfile | null;
  aiStatus: boolean;
  onStartScan?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, aiStatus }) => {
  return (
    <header className="top-header">
      <div className="header-status-group">
        <div className="status-indicator" title="Local SQLite Database status">
          <Database size={14} />
          <span className="status-dot active"></span>
          <span>SQLite Local DB</span>
        </div>

        <div className="status-indicator" title="Cluster Protocol AI Connection Status">
          <Cpu size={14} />
          <span className={`status-dot ${aiStatus ? 'active' : 'warning'}`}></span>
          <span>Cluster Protocol AI {aiStatus ? 'Active' : 'Key Missing / Offline'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div className="header-user">
          <div className="user-avatar">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-info">
            <div className="user-name">{profile?.name || 'Active Candidate'}</div>
            <div className="user-role">{profile?.primary_role || 'Software Engineer'}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
