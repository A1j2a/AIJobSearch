import React, { useEffect, useState } from 'react';
import { Job, UserProfile } from '../../shared/types';
import { fetchJobById, analyzeJobApi, fetchProfile } from '../api';
import {
  ArrowLeft,
  ExternalLink,
  Mail,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Sparkles,
  Building,
  MapPin,
  Calendar,
  DollarSign,
  Send,
  FileText,
  AlertCircle
} from 'lucide-react';

interface JobDetailPageProps {
  jobId: number;
  onBack: () => void;
}

export const JobDetailPage: React.FC<JobDetailPageProps> = ({ jobId, onBack }) => {
  const [job, setJob] = useState<Job | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzing, setAnalyzing] = useState<boolean>(false);

  // Email Template State
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    loadJobDetails();
  }, [jobId]);

  const loadJobDetails = async () => {
    setLoading(true);
    try {
      const [data, profileData] = await Promise.all([
        fetchJobById(jobId),
        fetchProfile().catch(() => null)
      ]);
      setJob(data);
      setProfile(profileData);

      if (data) {
        const candidateName = profileData?.name || 'Candidate';
        const candidateRole = profileData?.primary_role || 'Software Engineer';
        const candidateExp = profileData?.experience_text || `${profileData?.experience_years || 3}+ years experience`;
        const candidateLoc = profileData?.primary_location || 'India';
        const skillsStr = (profileData?.core_skills || []).slice(0, 6).join(', ');

        setEmailSubject(`Application for ${data.title} - ${candidateName}`);
        setEmailBody(
`Dear Hiring Team at ${data.company},

I am writing to submit my application for the ${data.title} position. With ${candidateExp} in ${candidateRole} and building production applications, I am eager to contribute to your team.

Key Technical Highlights:
• Core Specialization: ${skillsStr || 'Software Engineering & Scalable Systems'}
• Current Location: ${candidateLoc}
• Experience Level: ${candidateExp}

I have attached my active resume (${candidateName}_Resume.pdf) for your review and look forward to discussing how my experience aligns with ${data.company}'s goals.

Best regards,
${candidateName}
${candidateRole}
${candidateLoc}`
        );
      }
    } catch (err) {
      console.error('Error loading job details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!job) return;
    setAnalyzing(true);
    try {
      await analyzeJobApi(job.id);
      await loadJobDetails();
    } catch (err: any) {
      alert('Analysis error: ' + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopyEmail = () => {
    const fullText = `Subject: ${emailSubject}\n\n${emailBody}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (loading || !job) {
    return (
      <div className="page-container">
        <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '16px' }}>
          <ArrowLeft size={15} /> Back to Job Opportunities
        </button>
        <div style={{ textAlign: 'center', padding: '40px' }}>Loading Job Details...</div>
      </div>
    );
  }

  const detectedEmail = job.contact_email || (job.description.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || [])[0];

  const handleSendEmailRedirect = () => {
    if (!detectedEmail) return;
    const mailtoUrl = `mailto:${detectedEmail}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.location.href = mailtoUrl;
  };

  return (
    <div className="page-container">
      <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '16px' }}>
        <ArrowLeft size={15} /> Back to Opportunities
      </button>

      {/* Main Job Header Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{job.title}</h1>
              {job.remote && <span className="badge badge-info">Remote</span>}
              <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                Source: {job.source.replace('_', ' ')}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', color: 'var(--text-secondary)', fontSize: '0.85rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Building size={15} color="var(--accent-primary)" />
                <strong>{job.company}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={15} />
                <span>{job.location}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={15} />
                <span>Posted: {job.posted_date || 'Recently'}</span>
              </div>
              {job.salary_min && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <DollarSign size={15} />
                  <span>Salary: {job.salary_currency} {job.salary_min} - {job.salary_max}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons: If Email exists -> Send Email button, else -> Open Web Link */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {detectedEmail ? (
              <button
                className="btn btn-primary"
                onClick={handleSendEmailRedirect}
                style={{ padding: '8px 18px', fontWeight: 700 }}
              >
                <Send size={15} />
                <span>Send Email Application</span>
              </button>
            ) : (
              <a
                href={job.job_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ textDecoration: 'none', padding: '8px 18px', fontWeight: 700 }}
              >
                <span>Open Job Portal</span>
                <ExternalLink size={15} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* AI Match Breakdown Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginBottom: '20px' }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cluster Protocol AI Match Score
          </div>
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '50%',
            backgroundColor: (job.match_score || 0) >= 80 ? 'var(--status-success-bg)' : 'var(--status-warning-bg)',
            color: (job.match_score || 0) >= 80 ? 'var(--status-success)' : 'var(--status-warning)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.6rem',
            marginBottom: '10px',
            border: `2px solid ${(job.match_score || 0) >= 80 ? '#a7f3d0' : '#fef3c7'}`
          }}>
            {job.match_score || 0}%
          </div>

          <span className={`badge ${
            job.recommendation === 'APPLY' ? 'badge-success' : job.recommendation === 'MAYBE' ? 'badge-warning' : 'badge-info'
          }`} style={{ fontSize: '0.82rem', padding: '4px 12px' }}>
            Recommendation: {job.recommendation || 'APPLY'}
          </span>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleReanalyze}
            disabled={analyzing}
            style={{ marginTop: '14px' }}
          >
            <RefreshCw size={13} className={analyzing ? 'spin' : ''} />
            <span>Re-Analyze Job</span>
          </button>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>AI Compatibility Evaluation</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
            {job.ai_summary || 'Evaluated skills compatibility, experience level, location scope, and candidate resume match via Cluster Protocol AI.'}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--status-success)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle2 size={15} /> Matching Skills
              </div>
              <div className="tag-container">
                {(job.matching_skills || []).length > 0 ? (
                  job.matching_skills!.map((s, idx) => (
                    <span key={idx} className="badge badge-success">{s}</span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>General alignment</span>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Missing / Additional Requirements
              </div>
              <div className="tag-container">
                {(job.missing_skills || []).length > 0 ? (
                  job.missing_skills!.map((s, idx) => (
                    <span key={idx} className="badge badge-warning">{s}</span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.8rem', color: 'var(--status-success)' }}>All core skills matched!</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recruiter Email Application Section */}
      {detectedEmail ? (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={18} color="var(--accent-primary)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Direct Recruiter Email Application</h3>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleCopyEmail}>
                {copied ? <Check size={13} color="var(--status-success)" /> : <Copy size={13} />}
                <span>{copied ? 'Copied Content!' : 'Copy Email'}</span>
              </button>

              <button className="btn btn-primary btn-sm" onClick={handleSendEmailRedirect}>
                <Send size={13} />
                <span>Send Email Now</span>
              </button>
            </div>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontSize: '0.82rem', color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Mail size={15} /> Recruiter Email Detected: <code>{detectedEmail}</code>
          </div>

          {/* Attached Resume Reminder Note Box */}
          <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '10px 14px', borderRadius: 'var(--radius-md)', marginBottom: '14px', fontSize: '0.82rem', color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={15} />
            <span>Note: Please ensure you attach your Resume file (<code>{profile?.name || 'Candidate'}_Resume.pdf</code>) in your email client before hitting send!</span>
          </div>

          <div className="form-group">
            <label className="form-label">Subject Line</label>
            <input
              type="text"
              className="form-input"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Cold Cover Letter Body</label>
            <textarea
              className="form-textarea"
              rows={7}
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '20px', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="var(--accent-primary)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Public Board Opening</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                This job is listed on company career boards ({job.company}). Click below to view the official posting.
              </div>
            </div>
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-sm"
              style={{ marginLeft: 'auto', textDecoration: 'none' }}
            >
              <span>Open Job Portal</span>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>
      )}

      {/* Full Job Description */}
      <div className="card">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '10px' }}>Full Job Description</h3>
        <div style={{
          fontSize: '0.85rem',
          lineHeight: 1.6,
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-line',
          backgroundColor: '#f8fafc',
          padding: '14px 16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          {job.description}
        </div>
      </div>
    </div>
  );
};
