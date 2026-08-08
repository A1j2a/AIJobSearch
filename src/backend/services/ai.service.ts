import { db } from '../config/database.js';
import { UserProfile, SearchConfig } from '../../shared/types.js';
import { scoringService, ScoreBreakdown } from './scoring.service.js';

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
}

export class OllamaProvider implements AIProvider {
  public name = 'OllamaProvider';

  public async analyzeJob(
    job: { title: string; company: string; location: string; description: string; salaryMin?: number; remote?: boolean },
    profile: UserProfile,
    searchConfig: SearchConfig,
    resumeText: string
  ): Promise<AIAnalysisResult> {
    const urlRow = db.prepare("SELECT value FROM settings WHERE key = 'ollama_url'").get() as any;
    const modelRow = db.prepare("SELECT value FROM settings WHERE key = 'ollama_model'").get() as any;

    const ollamaUrl = urlRow?.value || 'http://localhost:11434';
    let ollamaModel = modelRow?.value || '';

    // Auto-discover model if not explicitly set in database
    if (!ollamaModel) {
      try {
        const tagsRes = await fetch(`${ollamaUrl}/api/tags`);
        if (tagsRes.ok) {
          const tagsData = await tagsRes.json();
          if (tagsData.models && tagsData.models.length > 0) {
            ollamaModel = tagsData.models[0].name || tagsData.models[0].model;
            db.prepare("INSERT INTO settings (key, value) VALUES ('ollama_model', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(ollamaModel);
            console.log(`[AI] Auto-detected installed Ollama model: ${ollamaModel}`);
          }
        }
      } catch (err: any) {
        console.warn('[AI] Could not auto-detect Ollama models:', err.message);
      }
    }

    // If no model selected or Ollama offline, use deterministic fallback analysis
    if (!ollamaModel) {
      console.log('[AI] No Ollama model selected in settings. Using deterministic rule fallback analysis.');
      return this.fallbackDeterministicAnalysis(job, profile, searchConfig);
    }

    const prompt = this.buildPrompt(job, profile, searchConfig, resumeText);

    try {
      const responseText = await this.callOllamaApi(ollamaUrl, ollamaModel, prompt);
      let parsed = this.tryParseJson(responseText);

      // Retry with correction prompt if JSON validation failed
      if (!parsed) {
        console.warn('[AI] Invalid JSON from Ollama. Retrying with correction prompt...');
        const correctionPrompt = `CRITICAL FIX: Your previous response was not valid JSON. You MUST reply ONLY with a valid JSON object matching this schema, with NO markdown formatting, NO extra text:\n{\n  "roleMatchPercentage": 90,\n  "isMobileRole": true,\n  "extractedRequiredSkills": ["React Native", "TypeScript"],\n  "extractedNiceToHaveSkills": ["Jest"],\n  "aiSummary": "Brief reasoning"\n}\n\nOriginal prompt output to format as raw JSON:\n${responseText}`;

        const correctedText = await this.callOllamaApi(ollamaUrl, ollamaModel, correctionPrompt);
        parsed = this.tryParseJson(correctedText);
      }

      if (!parsed) {
        console.warn('[AI] Ollama JSON parsing failed after retry. Falling back to deterministic scoring.');
        return this.fallbackDeterministicAnalysis(job, profile, searchConfig);
      }

      // Compute hybrid deterministic score using Ollama semantic outputs
      const scoreBreakdown = scoringService.calculateHybridScore(
        {
          ...job,
          remote: Boolean(job.remote)
        },
        profile,
        searchConfig,
        {
          roleMatchPercentage: parsed.roleMatchPercentage || 80,
          extractedRequiredSkills: Array.isArray(parsed.extractedRequiredSkills) ? parsed.extractedRequiredSkills : [],
          extractedNiceToHaveSkills: Array.isArray(parsed.extractedNiceToHaveSkills) ? parsed.extractedNiceToHaveSkills : [],
          isMobileRole: parsed.isMobileRole ?? true,
          aiSummary: parsed.aiSummary || 'Analyzed via Ollama local AI'
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
        reason: parsed.aiSummary || 'Strong technical skills and role alignment.',
        scoreBreakdown
      };
    } catch (error: any) {
      console.error('[AI] Ollama AI analysis error:', error.message);
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
Description: ${job.description.slice(0, 2000)}

=== INSTRUCTIONS ===
1. Determine if this job genuinely matches the candidate's primary target role (${profile.primary_role}) or preferred roles.
2. Extract required technical skills from the job description.
3. Extract optional/nice-to-have skills.
4. Provide a role match percentage (0 to 100).
5. Provide a 2-sentence concise summary explaining why it matches or what is missing.
6. NEVER invent candidate experience or skills.

Return ONLY a valid JSON object matching exact structure:
{
  "isTargetRoleMatch": true,
  "roleMatchPercentage": 85,
  "extractedRequiredSkills": [${coreSkills.slice(0, 3).map((s: string) => `"${s}"`).join(', ')}],
  "extractedNiceToHaveSkills": ["CI/CD"],
  "aiSummary": "Strong alignment with candidate ${profile.primary_role} experience."
}`;
  }

  private async callOllamaApi(url: string, model: string, prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          format: 'json'
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Ollama returned status ${response.status}`);
      }

      const data = await response.json();
      return data.response || '';
    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }
  }

  private tryParseJson(text: string): any {
    try {
      // Clean markdown code fence wrappers ```json ... ```
      let cleaned = text.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '');
      }
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }

  private fallbackDeterministicAnalysis(
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
      {
        ...job,
        remote: Boolean(job.remote)
      },
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

export const aiProvider = new OllamaProvider();
