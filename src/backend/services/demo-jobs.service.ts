import { dbAsync } from '../config/database';
import { generateJobDedupeKey } from '../utils/normalization';
import { aiProvider } from './ai.service';
import { UserProfile, SearchConfig } from '../../shared/types';

export const REALISTIC_DEMO_JOBS = [
  {
    externalId: 'demo-be-001',
    source: 'public_careers',
    title: 'Senior Backend Engineer',
    company: 'Fintech Cloud Systems',
    location: 'Ahmedabad, Gujarat, India',
    remote: true,
    salaryMin: 1200000,
    salaryMax: 2000000,
    salaryCurrency: 'INR',
    experienceMin: 3,
    experienceMax: 5,
    employmentType: 'Full Time',
    jobUrl: 'https://careers.fintechcloud.example/jobs/sr-backend-engineer',
    companyUrl: 'https://fintechcloud.example',
    postedDate: 'Just now',
    description: `Fintech Cloud Systems is looking for a Senior Backend Engineer to architect microservices and high-throughput financial transaction APIs.

Key Responsibilities:
- Design, build, and deploy high-performance microservices using Node.js, Express, Go, and Python.
- Database optimization and indexing for PostgreSQL, MySQL, and Redis caching layers.
- Build event-driven architectures with Kafka and RESTful API gateways.
- Implement Docker containerization, Kubernetes orchestration, and AWS cloud deployments.

Requirements:
- 3+ years experience in Backend Engineering, Node.js, Python, PostgreSQL, and REST APIs.
- Deep understanding of microservices architecture, Docker, AWS, and Git version control.`
  },
  {
    externalId: 'demo-be-002',
    source: 'greenhouse',
    title: 'Lead Backend Developer & Systems Architect',
    company: 'SaaS Scale Labs',
    location: 'Remote - India',
    remote: true,
    salaryMin: 1500000,
    salaryMax: 2400000,
    salaryCurrency: 'INR',
    experienceMin: 4,
    experienceMax: 7,
    employmentType: 'Full Time',
    jobUrl: 'https://boards.greenhouse.io/saasscale/jobs/lead-backend',
    companyUrl: 'https://saasscale.example',
    postedDate: '1 day ago',
    description: `Looking for a Lead Backend Developer specializing in scalable distributed systems and cloud architecture.

Requirements:
- Node.js, Express, Go, PostgreSQL, Redis, Docker, Kubernetes, AWS, System Design.`
  },
  {
    externalId: 'demo-rn-001',
    source: 'public_careers',
    title: 'Senior React Native Developer',
    company: 'TechCorp Solutions',
    location: 'Ahmedabad, Gujarat, India',
    remote: true,
    salaryMin: 800000,
    salaryMax: 1400000,
    salaryCurrency: 'INR',
    experienceMin: 3,
    experienceMax: 5,
    employmentType: 'Full Time',
    jobUrl: 'https://careers.techcorp.example/jobs/sr-react-native-developer',
    companyUrl: 'https://techcorp.example',
    postedDate: '2 days ago',
    description: `We are looking for a Senior React Native Developer with 3+ years of professional mobile experience to build high-performance cross-platform applications.

Key Responsibilities:
- Design and build advanced applications for Android & iOS using React Native, TypeScript, and Expo.
- Integrate REST APIs, Firebase Authentication, and FCM Push Notifications.
- Handle app publishing on Google Play Store & Apple App Store.
- Optimize app performance and implement payment gateways (Razorpay, Stripe).`
  },
  {
    externalId: 'demo-fullstack-001',
    source: 'lever',
    title: 'Full Stack Software Engineer (Node.js + React)',
    company: 'NextGen Innovations',
    location: 'Pune, Maharashtra, India',
    remote: true,
    salaryMin: 1000000,
    salaryMax: 1600000,
    salaryCurrency: 'INR',
    experienceMin: 3,
    experienceMax: 5,
    employmentType: 'Full Time',
    jobUrl: 'https://jobs.lever.co/nextgen/fullstack-engineer',
    companyUrl: 'https://nextgen.example',
    postedDate: '3 days ago',
    description: `NextGen Innovations is hiring a Full Stack Engineer to build web and backend platforms using React, Node.js, TypeScript, PostgreSQL, and AWS.`
  }
];

export async function seedDemoJobs(): Promise<{ added: number; skipped: number }> {
  console.log('[DEMO] Seeding realistic sample jobs...');
  let added = 0;
  let skipped = 0;

  const pRow = await dbAsync.get('SELECT * FROM profile ORDER BY id ASC LIMIT 1') as any;
  const rRow = await dbAsync.get('SELECT * FROM resume_versions WHERE is_active = 1 LIMIT 1') as any;
  const sRow = await dbAsync.get('SELECT * FROM search_configs ORDER BY id ASC LIMIT 1') as any;

  if (!pRow || !sRow) {
    console.error('[DEMO] Missing profile or search config');
    return { added: 0, skipped: 0 };
  }

  const profile: UserProfile = {
    ...pRow,
    preferred_locations: JSON.parse(pRow.preferred_locations || '[]'),
    preferred_roles: JSON.parse(pRow.preferred_roles || '[]'),
    core_skills: JSON.parse(pRow.core_skills || '[]')
  };

  const searchConfig: SearchConfig = {
    ...sRow,
    keywords: JSON.parse(sRow.keywords || '[]'),
    remote_allowed: Boolean(sRow.remote_allowed)
  };

  const resumeText = rRow ? rRow.resume_text : '';

  for (const rawJob of REALISTIC_DEMO_JOBS) {
    try {
      await dbAsync.run(
        `INSERT OR IGNORE INTO jobs (source, external_id, title, company, location, remote, salary_min, salary_max, salary_currency, experience_min, experience_max, employment_type, description, job_url, company_url, posted_date, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [rawJob.source, rawJob.externalId, rawJob.title, rawJob.company, rawJob.location, rawJob.remote ? 1 : 0, rawJob.salaryMin, rawJob.salaryMax, rawJob.salaryCurrency, rawJob.experienceMin, rawJob.experienceMax, rawJob.employmentType, rawJob.description, rawJob.jobUrl, rawJob.companyUrl, rawJob.postedDate]
      );

      const insertedRow = await dbAsync.get('SELECT id FROM jobs WHERE source = ? AND external_id = ?', [rawJob.source, rawJob.externalId]) as any;
      if (!insertedRow) { skipped++; continue; }

      const existingAnalysis = await dbAsync.get('SELECT id FROM job_analysis WHERE job_id = ?', [insertedRow.id]) as any;
      if (existingAnalysis) { skipped++; continue; }

      added++;
      const jobId = insertedRow.id;
      const analysis = await aiProvider.analyzeJob(rawJob, profile, searchConfig, resumeText);

      await dbAsync.run(
        `INSERT OR REPLACE INTO job_analysis (job_id, match_score, role_score, skills_score, experience_score, location_score, employment_type_score, salary_score, seniority_score, other_score, matching_skills, missing_skills, required_skills, nice_to_have_skills, ai_summary, recommendation)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [jobId, analysis.matchScore, analysis.scoreBreakdown?.roleScore || 0, analysis.scoreBreakdown?.skillsScore || 0, analysis.scoreBreakdown?.experienceScore || 0, analysis.scoreBreakdown?.locationScore || 0, analysis.scoreBreakdown?.employmentTypeScore || 0, analysis.scoreBreakdown?.salaryScore || 0, analysis.scoreBreakdown?.seniorityScore || 0, analysis.scoreBreakdown?.otherScore || 0, JSON.stringify(analysis.matchingSkills), JSON.stringify(analysis.missingSkills), JSON.stringify(analysis.requiredSkills), JSON.stringify(analysis.niceToHaveSkills), analysis.reason, analysis.recommendation]
      );
    } catch (err: any) {
      console.error('[DEMO] Error seeding job:', rawJob.title, err.message);
      skipped++;
    }
  }

  await dbAsync.run(`INSERT INTO logs (component, event, status, message) VALUES (?, ?, ?, ?)`,
    ['JOBS', 'SEED_DEMO_JOBS', 'SUCCESS', `Seeded ${added} realistic demo jobs. ${skipped} duplicates skipped.`]);

  return { added, skipped };
}

