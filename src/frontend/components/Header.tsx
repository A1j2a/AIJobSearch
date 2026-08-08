import React from 'react';
import { Database, Cpu, Play } from 'lucide-react';
import { UserProfile } from '../../shared/types';

interface HeaderProps {
  profile: UserProfile | null;
  ollamaStatus: boolean;
  onStartScan: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, ollamaStatus, onStartScan }) => {
  return (
    <header className="top-header">
      <div className="header-status-group">
        <div className="status-indicator" title="Local SQLite Database status">
          <Database size={14} />
          <span className="status-dot active"></span>
          <span>SQLite Local DB</span>
        </div>

        <div className="status-indicator" title="Local AI (Ollama) Connection Status">
          <Cpu size={14} />
          <span className={`status-dot ${ollamaStatus ? 'active' : 'warning'}`}></span>
          <span>Ollama AI {ollamaStatus ? 'Connected' : 'Offline'}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn btn-primary" onClick={onStartScan}>
          <Play size={16} />
          <span>Scan Jobs</span>
        </button>

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
