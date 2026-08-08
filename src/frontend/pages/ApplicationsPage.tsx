import React, { useEffect, useState } from 'react';
import { Job, UserProfile } from '../../shared/types';
import { fetchApplicationsApi, updateApplicationStatusApi, fetchProfile } from '../api';
import { Briefcase, Send, UserCheck, Star, Trash2, ChevronRight, Mail, ExternalLink, MapPin, Globe, Building, CheckCircle2, Eye } from 'lucide-react';

interface ApplicationsPageProps {
  onNavigateToJobDetail: (jobId: number) => void;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({ onNavigateToJobDetail }) => {
  const [applications, setApplications] = useState<Job[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEmailJob, setSelectedEmailJob] = useState<Job | null>(null);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const [appData, profileData] = await Promise.all([
        fetchApplicationsApi(),
        fetchProfile()
      ]);
      setApplications(appData.applications);
      setProfile(profileData);
    } catch (err) {
      console.error('Error loading applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (jobId: number, status: string) => {
    try {
      await updateApplicationStatusApi(jobId, status);
      loadApplications();
    } catch (err: any) {
      alert('Failed to update status: ' + err.message);
    }
  };

  const savedJobs = applications.filter(a => !a.application_status || a.application_status === 'Saved');
  const appliedJobs = applications.filter(a => a.application_status === 'Applied');
  const interviewingJobs = applications.filter(a => a.application_status === 'Interviewing' || a.application_status === 'Interview');
  const offeredJobs = applications.filter(a => a.application_status === 'Offered');

  const generateColdEmail = (job: Job) => {
    const candidateName = profile?.name || 'Candidate';
    const primaryRole = profile?.primary_role || 'Software Engineer';
    const skillsList = (profile?.core_skills || ['React Native', 'TypeScript']).slice(0, 4).join(', ');

    return `Subject: Application for ${job.title} Position - ${candidateName}

Hi Hiring Team at ${job.company},

I hope this email finds you well. I am reaching out to express my strong interest in the ${job.title} role at ${job.company}.

With experience as a ${primaryRole}, I have hands-on expertise in ${skillsList}. After reviewing the position requirements, I am confident that my background aligns closely with what your engineering team is building.

Key Highlights of my experience:
• Specialized in ${job.title} architecture & scalable software engineering.
• Hands-on production experience in ${skillsList}.
• Track record of delivering high-performance applications.

I would love the opportunity to connect for a quick 10-minute chat to discuss how I can contribute to ${job.company}'s goals.

Best regards,
${candidateName}
${job.contact_email ? `Contact: ${job.contact_email}` : ''}`;
  };

  return (
    <div className="page-container">
      <div className="page-title-section">
        <div>
          <h1 className="page-title">Application Tracker Board</h1>
          <p className="page-subtitle">Track your job applications, interviews, and generated cold emails in real-time</p>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Application Tracker...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', alignItems: 'start' }}>
          
          {/* COLUMN 1: SAVED JOBS */}
          <div className="card" style={{ padding: '12px', minHeight: '500px', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid var(--accent-primary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent-primary)' }}>
                <Briefcase size={16} /> Saved Jobs
              </div>
              <span className="badge badge-secondary">{savedJobs.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {savedJobs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                  No saved jobs yet. Click <strong>"Save"</strong> on any job card in Dashboard or Search to add jobs here!
                </div>
              ) : (
                savedJobs.map(job => (
                  <div key={job.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: '#fff' }}>
                    <div
                      style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-primary)', cursor: 'pointer', marginBottom: '4px' }}
                      onClick={() => onNavigateToJobDetail(job.id)}
                    >
                      {job.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{job.company} • {job.location}</div>
                    
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.72rem' }} onClick={() => onNavigateToJobDetail(job.id)}>
                        <Eye size={11} /> Details
                      </button>
                      <button className="btn btn-primary btn-sm" style={{ padding: '2px 6px', fontSize: '0.72rem' }} onClick={() => handleUpdateStatus(job.id, 'Applied')}>
                        <Send size={11} /> Applied
                      </button>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.72rem' }} onClick={() => setSelectedEmailJob(job)}>
                        <Mail size={11} /> Pitch
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: APPLIED */}
          <div className="card" style={{ padding: '12px', minHeight: '500px', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid var(--status-warning)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--status-warning)' }}>
                <Send size={16} /> Applied
              </div>
              <span className="badge badge-warning">{appliedJobs.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {appliedJobs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                  No applications tracked as Applied yet.
                </div>
              ) : (
                appliedJobs.map(job => (
                  <div key={job.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: '#fff' }}>
                    <div
                      style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-primary)', cursor: 'pointer', marginBottom: '4px' }}
                      onClick={() => onNavigateToJobDetail(job.id)}
                    >
                      {job.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{job.company} • {job.location}</div>
                    
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.72rem' }} onClick={() => onNavigateToJobDetail(job.id)}>
                        <Eye size={11} /> Details
                      </button>
                      <button className="btn btn-primary btn-sm" style={{ padding: '2px 6px', fontSize: '0.72rem' }} onClick={() => handleUpdateStatus(job.id, 'Interviewing')}>
                        <UserCheck size={11} /> Interview
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: INTERVIEWING */}
          <div className="card" style={{ padding: '12px', minHeight: '500px', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid var(--status-info)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--status-info)' }}>
                <UserCheck size={16} /> Interviewing
              </div>
              <span className="badge badge-info">{interviewingJobs.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {interviewingJobs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                  No active interview rounds.
                </div>
              ) : (
                interviewingJobs.map(job => (
                  <div key={job.id} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: '#fff' }}>
                    <div
                      style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-primary)', cursor: 'pointer', marginBottom: '4px' }}
                      onClick={() => onNavigateToJobDetail(job.id)}
                    >
                      {job.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{job.company} • {job.location}</div>
                    
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.72rem' }} onClick={() => onNavigateToJobDetail(job.id)}>
                        <Eye size={11} /> Details
                      </button>
                      <button className="btn btn-success btn-sm" style={{ padding: '2px 6px', fontSize: '0.72rem' }} onClick={() => handleUpdateStatus(job.id, 'Offered')}>
                        <CheckCircle2 size={11} /> Offered
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 4: OFFERED */}
          <div className="card" style={{ padding: '12px', minHeight: '500px', backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '8px', borderBottom: '2px solid var(--status-success)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', color: 'var(--status-success)' }}>
                <CheckCircle2 size={16} /> Offered
              </div>
              <span className="badge badge-success">{offeredJobs.length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {offeredJobs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                  No offers recorded yet.
                </div>
              ) : (
                offeredJobs.map(job => (
                  <div key={job.id} style={{ border: '1px solid var(--status-success)', borderRadius: 'var(--radius-sm)', padding: '10px', backgroundColor: 'var(--status-success-bg)' }}>
                    <div
                      style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--status-success)', cursor: 'pointer', marginBottom: '4px' }}
                      onClick={() => onNavigateToJobDetail(job.id)}
                    >
                      🎉 {job.title}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{job.company} • {job.location}</div>
                    
                    <button className="btn btn-secondary btn-sm" style={{ padding: '2px 6px', fontSize: '0.72rem' }} onClick={() => onNavigateToJobDetail(job.id)}>
                      <Eye size={11} /> Details
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Recruiter Cold Email Modal */}
      {selectedEmailJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '550px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-primary)' }}>
              ✉️ Cold Email Pitch Generator: {selectedEmailJob.company}
            </h3>
            
            <textarea
              style={{ width: '100%', height: '220px', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', fontFamily: 'monospace', lineHeight: 1.5, marginBottom: '12px' }}
              value={generateColdEmail(selectedEmailJob)}
              readOnly
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedEmailJob(null)}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                navigator.clipboard.writeText(generateColdEmail(selectedEmailJob));
                alert('Cold Email pitch copied to clipboard!');
              }}>
                Copy Pitch Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
