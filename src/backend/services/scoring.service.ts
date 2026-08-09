import { UserProfile, SearchConfig } from '../../shared/types';

export interface SemanticAIOutput {
  roleMatchPercentage: number;
  extractedRequiredSkills: string[];
  extractedNiceToHaveSkills: string[];
  extractedExperienceYears?: number;
  extractedSeniority?: string;
  isMobileRole: boolean;
  aiSummary: string;
}

export interface ScoreBreakdown {
  finalScore: number;
  roleScore: number;          // max 30
  skillsScore: number;        // max 25
  experienceScore: number;    // max 15
  locationScore: number;      // max 10
  employmentTypeScore: number;// max 5
  salaryScore: number;        // max 5
  seniorityScore: number;     // max 5
  otherScore: number;         // max 5
  matchingSkills: string[];
  missingSkills: string[];
  recommendation: 'APPLY' | 'MAYBE' | 'SKIP';
}

export class ScoringService {
  /**
   * Deterministically calculates final 0-100 score from candidate profile, job details, and Cluster Protocol AI semantic extraction
   */
  public calculateHybridScore(
    job: {
      title: string;
      location: string;
      remote: boolean;
      experienceMin?: number | null;
      experienceMax?: number | null;
      employmentType?: string;
      salaryMin?: number | null;
    },
    profile: UserProfile,
    searchConfig: SearchConfig,
    aiSemantic: SemanticAIOutput
  ): ScoreBreakdown {
    // Safe array normalization
    const prefRoles: string[] = Array.isArray(profile.preferred_roles)
      ? profile.preferred_roles
      : JSON.parse((profile.preferred_roles as any) || '[]');
    const prefLocs: string[] = Array.isArray(profile.preferred_locations)
      ? profile.preferred_locations
      : JSON.parse((profile.preferred_locations as any) || '[]');
    const candidateSkills: string[] = Array.isArray(profile.core_skills)
      ? profile.core_skills
      : JSON.parse((profile.core_skills as any) || '[]');

    // 1. Role Match Score (Weight: 30%)
    let roleScore = 0;
    const titleLower = job.title.toLowerCase();
    const isPreferredRoleMatch = prefRoles.some(r => titleLower.includes(r.toLowerCase()));
    
    if (aiSemantic.isMobileRole || isPreferredRoleMatch) {
      roleScore = (aiSemantic.roleMatchPercentage / 100) * 30;
    } else {
      roleScore = Math.min(15, (aiSemantic.roleMatchPercentage / 100) * 15);
    }

    // 2. Technical Skills Score (Weight: 25%)
    const requiredSkills = aiSemantic.extractedRequiredSkills.length > 0
      ? aiSemantic.extractedRequiredSkills
      : (candidateSkills.length > 0 ? candidateSkills.slice(0, 3) : ['Software Engineering', 'TypeScript', 'JavaScript']);
    
    const candidateSkillsLower = candidateSkills.map(s => s.toLowerCase());
    const matchingSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const reqSkill of requiredSkills) {
      if (candidateSkillsLower.includes(reqSkill.toLowerCase())) {
        matchingSkills.push(reqSkill);
      } else {
        missingSkills.push(reqSkill);
      }
    }

    const skillRatio = requiredSkills.length > 0 ? matchingSkills.length / requiredSkills.length : 1.0;
    const skillsScore = skillRatio * 25;

    // 3. Experience Score (Weight: 15%)
    let experienceScore = 15;
    const candidateExp = profile.experience_years;
    const jobMinExp = job.experienceMin ?? searchConfig.min_experience;
    const jobMaxExp = job.experienceMax ?? searchConfig.max_experience;

    if (candidateExp < jobMinExp) {
      const diff = jobMinExp - candidateExp;
      experienceScore = Math.max(0, 15 - (diff * 5));
    } else if (candidateExp > jobMaxExp + 3) {
      experienceScore = 12; // slightly overqualified
    }

    // 4. Location & Remote Score (Weight: 10%)
    let locationScore = 0;
    const jobLocLower = job.location.toLowerCase();
    const matchesPreferredLocation = prefLocs.some(loc => jobLocLower.includes(loc.toLowerCase()));

    if (job.remote && searchConfig.remote_allowed) {
      locationScore = 10;
    } else if (matchesPreferredLocation) {
      locationScore = 10;
    } else if (profile.primary_location && jobLocLower.includes(profile.primary_location.toLowerCase())) {
      locationScore = 10;
    } else {
      locationScore = 3;
    }

    // 5. Employment Type Score (Weight: 5%)
    let employmentTypeScore = 5;
    if (job.employmentType && searchConfig.job_type) {
      if (job.employmentType.toLowerCase() !== searchConfig.job_type.toLowerCase()) {
        employmentTypeScore = 3;
      }
    }

    // 6. Salary Score (Weight: 5%)
    const salaryScore = 5; // Default full credit if unstated

    // 7. Seniority Score (Weight: 5%)
    let seniorityScore = 5;
    if (titleLower.includes('lead') || titleLower.includes('architect') || titleLower.includes('principal')) {
      seniorityScore = 3;
    }

    // 8. Other Requirements (Weight: 5%)
    const otherScore = aiSemantic.extractedNiceToHaveSkills.length > 0 ? 4 : 5;

    // Compute transparent total score
    const finalScore = Math.round(
      roleScore + skillsScore + experienceScore + locationScore + employmentTypeScore + salaryScore + seniorityScore + otherScore
    );

    let recommendation: 'APPLY' | 'MAYBE' | 'SKIP' = 'SKIP';
    if (finalScore >= (searchConfig.min_match_score || 80)) {
      recommendation = 'APPLY';
    } else if (finalScore >= 65) {
      recommendation = 'MAYBE';
    }

    return {
      finalScore: Math.min(100, Math.max(0, finalScore)),
      roleScore: Math.round(roleScore),
      skillsScore: Math.round(skillsScore),
      experienceScore: Math.round(experienceScore),
      locationScore: Math.round(locationScore),
      employmentTypeScore,
      salaryScore,
      seniorityScore,
      otherScore,
      matchingSkills,
      missingSkills,
      recommendation
    };
  }
}

export const scoringService = new ScoringService();
