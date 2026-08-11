import { dbAsync } from '../config/database';
import { UserProfile, SearchConfig } from '../../shared/types';
import { scoringService, ScoreBreakdown } from './scoring.service';

export interface AIAnalysisResult {
  matchScore: number;
  roleMatch: number;
  skillsMatch: number;
  experienceMatch: number;
  locationMatch: number;
  salaryMatch: number;
  matchingSkills: string[];
  missingSkills: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  recommendation: 'APPLY' | 'MAYBE' | 'SKIP';
  reason: string;
  scoreBreakdown?: ScoreBreakdown;
}

export interface AIProvider {
  name: string;
  analyzeJob(
    job: { title: string; company: string; location: string; description: string; salaryMin?: number; remote?: boolean },
    profile: UserProfile,
    searchConfig: SearchConfig,
    resumeText: string
  ): Promise<AIAnalysisResult>;
  fallbackDeterministicAnalysis(
    job: { title: string; company: string; location: string; description: string; remote?: boolean; salaryMin?: number },
    profile: UserProfile,
    searchConfig: SearchConfig
  ): AIAnalysisResult;
}

export const CLUSTER_MODEL_MAP: Record<string, string> = {
  'best-model': 'qwen-2.5-coder-32b-instruct',
  'qwen': 'qwen-2.5-coder-32b-instruct',
  'deepseek': 'qwen-2.5-coder-32b-instruct',
  'llama': 'llama-3.3-70b-instruct'
};

export class ClusterProtocolProvider implements AIProvider {
  public name = 'ClusterProtocolProvider';
  private consecutiveErrors = 0;
  private maxConsecutiveErrors = 2;
  private lastErrorResetTime = Date.now();

  public async analyzeJob(
    job: { title: string; company: string; location: string; description: string; salaryMin?: number; remote?: boolean },
    profile: UserProfile,
    searchConfig: SearchConfig,
    resumeText: string
  ): Promise<AIAnalysisResult> {
    // Reset circuit breaker every 60 seconds
    if (Date.now() - this.lastErrorResetTime > 60000) {
      this.consecutiveErrors = 0;
      this.lastErrorResetTime = Date.now();
    }

    // Circuit Breaker: If upstream API is down/rate-limited, fallback instantly (0ms execution time)
    if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
      return this.fallbackDeterministicAnalysis(job, profile, searchConfig);
    }

    const urlRow = await dbAsync.get("SELECT value FROM settings WHERE key = 'cluster_api_url'") as any;
    const apiKeyRow = await dbAsync.get("SELECT value FROM settings WHERE key = 'cluster_api_key'") as any;
    const modelRow = await dbAsync.get("SELECT value FROM settings WHERE key = 'cluster_model'") as any;

    const HARDCODED_CLUSTER_KEY = 'cp_b585d212b386450a88f866049aa19fc0af387b46279719b75c588543e275dede';
    const clusterApiUrl = urlRow?.value || process.env.CLUSTER_API_URL || 'https://api.clusterprotocol.ai/v1';
    const clusterApiKey = (apiKeyRow?.value || '').trim() || (process.env.CLUSTER_API_KEY || '').trim() || HARDCODED_CLUSTER_KEY;
    const rawModel = modelRow?.value || 'best-model';

    const targetModel = CLUSTER_MODEL_MAP[rawModel.toLowerCase()] || rawModel;

    if (!clusterApiKey) {
      return this.fallbackDeterministicAnalysis(job, profile, searchConfig);
    }

    const prompt = this.buildPrompt(job, profile, searchConfig, resumeText);

    try {
      const responseText = await this.callClusterApi(clusterApiUrl, clusterApiKey, targetModel, prompt);
      const parsed = this.tryParseJson(responseText);

      if (!parsed) {
        return this.fallbackDeterministicAnalysis(job, profile, searchConfig);
      }

      this.consecutiveErrors = 0; // Success -> reset error counter

      const scoreBreakdown = scoringService.calculateHybridScore(
        { ...job, remote: Boolean(job.remote) },
        profile,
        searchConfig,
        {
          roleMatchPercentage: parsed.roleMatchPercentage || 80,
          extractedRequiredSkills: Array.isArray(parsed.extractedRequiredSkills) ? parsed.extractedRequiredSkills : [],
          extractedNiceToHaveSkills: Array.isArray(parsed.extractedNiceToHaveSkills) ? parsed.extractedNiceToHaveSkills : [],
          isMobileRole: parsed.isMobileRole ?? true,
          aiSummary: parsed.aiSummary || `Analyzed via Cluster Protocol AI (${rawModel})`
        }
      );

      return {
        matchScore: scoreBreakdown.finalScore,
        roleMatch: scoreBreakdown.roleScore,
        skillsMatch: scoreBreakdown.skillsScore,
        experienceMatch: scoreBreakdown.experienceScore,
        locationMatch: scoreBreakdown.locationScore,
        salaryMatch: scoreBreakdown.salaryScore,
        matchingSkills: scoreBreakdown.matchingSkills,
        missingSkills: scoreBreakdown.missingSkills,
        requiredSkills: parsed.extractedRequiredSkills || [],
        niceToHaveSkills: parsed.extractedNiceToHaveSkills || [],
        recommendation: scoreBreakdown.recommendation,
        reason: parsed.aiSummary || 'Technical skills and role alignment.',
        scoreBreakdown
      };
    } catch (error: any) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.warn(`[AI] Upstream API rate-limited or erroring. Tripping circuit breaker to fast deterministic scoring (0ms).`);
      }
      return this.fallbackDeterministicAnalysis(job, profile, searchConfig);
    }
  }

  private buildPrompt(
    job: { title: string; company: string; location: string; description: string },
    profile: UserProfile,
    searchConfig: SearchConfig,
    resumeText: string
  ): string {
    const prefLocs = Array.isArray(profile.preferred_locations) ? profile.preferred_locations : JSON.parse((profile.preferred_locations as any) || '[]');
    const coreSkills = Array.isArray(profile.core_skills) ? profile.core_skills : JSON.parse((profile.core_skills as any) || '[]');

    return `You are an expert technical recruiter analyzing job relevance for a software candidate.

=== CANDIDATE PROFILE ===
Name: ${profile.name}
Primary Target Role: ${profile.primary_role}
Experience: ${profile.experience_years} years (${profile.experience_text})
Location: ${profile.primary_location}
Preferred Locations: ${prefLocs.join(', ')}
Master Technical Skills: ${coreSkills.join(', ')}

=== MASTER RESUME TEXT ===
${resumeText.slice(0, 1500)}

=== JOB POSTING ===
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description.slice(0, 1500)}

=== INSTRUCTIONS ===
Return ONLY a valid JSON object matching exact structure:
{
  "isTargetRoleMatch": true,
  "roleMatchPercentage": 85,
  "extractedRequiredSkills": [${coreSkills.slice(0, 3).map((s: string) => `"${s}"`).join(', ')}],
  "extractedNiceToHaveSkills": ["CI/CD"],
  "aiSummary": "Strong alignment with candidate ${profile.primary_role} experience."
}`;
  }

  private async callClusterApi(baseUrl: string, apiKey: string, model: string, prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const endpoint = cleanBaseUrl.endsWith('/chat/completions') 
      ? cleanBaseUrl 
      : `${cleanBaseUrl}/chat/completions`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: 'You are an expert AI software recruiter. You reply ONLY in raw valid JSON without markdown code fences.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          max_tokens: 1024
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Cluster Protocol API returned HTTP status ${response.status}: ${errText.slice(0, 100)}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || data.response || '';
    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private tryParseJson(text: string): any {
    try {
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }

  public fallbackDeterministicAnalysis(
    job: { title: string; company: string; location: string; description: string; remote?: boolean; salaryMin?: number },
    profile: UserProfile,
    searchConfig: SearchConfig
  ): AIAnalysisResult {
    const prefRoles: string[] = Array.isArray(profile.preferred_roles)
      ? profile.preferred_roles
      : JSON.parse((profile.preferred_roles as any) || '[]');
    const candidateSkills: string[] = Array.isArray(profile.core_skills)
      ? profile.core_skills
      : JSON.parse((profile.core_skills as any) || '[]');

    const descLower = job.description.toLowerCase();
    const titleLower = job.title.toLowerCase();

    const requiredSkills: string[] = [];
    for (const skill of candidateSkills) {
      if (descLower.includes(skill.toLowerCase())) {
        requiredSkills.push(skill);
      }
    }

    const isTargetRoleMatch = prefRoles.some(r => titleLower.includes(r.toLowerCase())) ||
                              (profile.primary_role && titleLower.includes(profile.primary_role.toLowerCase()));

    const scoreBreakdown = scoringService.calculateHybridScore(
      { ...job, remote: Boolean(job.remote) },
      profile,
      searchConfig,
      {
        roleMatchPercentage: isTargetRoleMatch ? 90 : 60,
        extractedRequiredSkills: requiredSkills.length > 0 ? requiredSkills : candidateSkills.slice(0, 3),
        extractedNiceToHaveSkills: ['Git', 'CI/CD'],
        isMobileRole: Boolean(isTargetRoleMatch),
        aiSummary: isTargetRoleMatch
          ? `Strong role match for ${profile.primary_role || 'Candidate'} based on core skills and experience.`
          : `Partial match for ${profile.primary_role || 'Candidate'}.`
      }
    );

    return {
      matchScore: scoreBreakdown.finalScore,
      roleMatch: scoreBreakdown.roleScore,
      skillsMatch: scoreBreakdown.skillsScore,
      experienceMatch: scoreBreakdown.experienceScore,
      locationMatch: scoreBreakdown.locationScore,
      salaryMatch: scoreBreakdown.salaryScore,
      matchingSkills: scoreBreakdown.matchingSkills,
      missingSkills: scoreBreakdown.missingSkills,
      requiredSkills,
      niceToHaveSkills: ['CI/CD', 'Git'],
      recommendation: scoreBreakdown.recommendation,
      reason: isTargetRoleMatch
        ? `Direct match for ${profile.primary_role} experience and candidate preferences.`
        : `Requires review for ${profile.primary_role} skill alignment.`,
      scoreBreakdown
    };
  }
}

export const aiProvider = new ClusterProtocolProvider();
