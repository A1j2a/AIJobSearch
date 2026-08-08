import React from 'react';
import {
  LayoutDashboard,
  Briefcase,
  BookmarkCheck,
  Kanban,
  FileText,
  Search,
  Scan,
  BarChart3,
  Terminal,
  Settings,
  Bot
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'jobs'
  | 'saved'
  | 'applications'
  | 'resume'
  | 'search'
  | 'scanner'
  | 'analytics'
  | 'logs'
  | 'settings';

interface SidebarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onSelectPage }) => {
  const menuItems: { id: PageId; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'jobs', label: 'Jobs', icon: <Briefcase size={18} /> },
    { id: 'saved', label: 'Saved Jobs', icon: <BookmarkCheck size={18} /> },
    { id: 'applications', label: 'Applications', icon: <Kanban size={18} /> },
    { id: 'resume', label: 'Resume & Profile', icon: <FileText size={18} /> },
    { id: 'search', label: 'Search Criteria', icon: <Search size={18} /> },
    { id: 'scanner', label: 'Job Scanner', icon: <Scan size={18} /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { id: 'logs', label: 'System Logs', icon: <Terminal size={18} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <Bot size={24} color="#2563eb" />
        <span className="sidebar-brand">AI Job Finder</span>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onSelectPage(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div>Local AI Matcher v1.0</div>
        <div>Mac Desktop Edition</div>
      </div>
    </aside>
  );
};
