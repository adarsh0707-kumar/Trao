import { ResilientLLMClient, llmClient } from "./llm.js";
import type { RoleInfo, Requirement } from "@trao/shared";

const EXTRACTOR_SYSTEM_PROMPT = `You are a precision Job Description parser for technical hiring assessments.
Your task is to extract the exact role title, seniority level, core responsibilities, and requirements from the given job description text.

CRITICAL RULES:
1. NEVER INVENT OR HALLUCINATE REQUIREMENTS. If the posting is only 2 lines long, extract ONLY what is stated.
2. PRIORITY CLASSIFICATION:
   - "must": Requirements stated as mandatory, essential, required, or core responsibilities (e.g., "5+ years React", "Must have Node.js", "Experience leading teams").
   - "nice": Bonus qualifications, differentiators, or preferences (e.g., "Bonus points for", "Nice to have", "Preferred", "Familiarity with").
3. KIND CLASSIFICATION:
   - "technical": Specific programming languages, frameworks, databases, architectures, cloud tools.
   - "behavioural": Mentorship, communication, leadership, agile practices, cross-team collaboration.
   - "domain": Industry-specific knowledge (e.g., FinTech regulations, HIPAA, eCommerce payments).
4. STABLE IDS:
   - Assign sequential IDs: "r1", "r2", "r3", etc.
5. JSON OUTPUT FORMAT:
   Return ONLY valid JSON matching this schema:
   {
     "title": string,
     "seniority": string,
     "responsibilities": string[],
     "requirements": [
       { "id": "r1", "text": string, "kind": "technical" | "behavioural" | "domain", "priority": "must" | "nice" }
     ]
   }
`;

/**
 * Extracts structured requirements from raw Job Description text
 */
export async function extractRoleRequirements(
  jdText: string,
  client: ResilientLLMClient = llmClient
): Promise<RoleInfo> {
  const trimmedJd = jdText.trim();

  // Edge case handling: Empty or minimal stub
  if (!trimmedJd) {
    return {
      title: "Unknown Role",
      seniority: "Not Specified",
      responsibilities: ["General engineering duties"],
      requirements: [
        {
          id: "r1",
          text: "General problem solving & software development",
          kind: "technical",
          priority: "must",
        },
      ],
    };
  }

  const prompt = `Please extract the requirements from the following Job Description text:

<job_description>
${trimmedJd}
</job_description>

Remember: Do not invent requirements that are not in the text. Mark must vs nice strictly based on the wording.`;

  try {
    const extracted = await client.generateJSON<RoleInfo>(
      prompt,
      { temperature: 0.1 },
      EXTRACTOR_SYSTEM_PROMPT
    );

    // Sanitize and guarantee stable sequential IDs
    const requirements: Requirement[] = (extracted.requirements || []).map(
      (req, index) => ({
        id: `r${index + 1}`,
        text: String(req.text || "Requirement"),
        kind: (["technical", "behavioural", "domain"].includes(req.kind)
          ? req.kind
          : "technical") as Requirement["kind"],
        priority: (["must", "nice"].includes(req.priority)
          ? req.priority
          : "must") as Requirement["priority"],
      })
    );

    // If no requirements were extracted (e.g. ultra-thin 1-line JD), extract from title/text
    if (requirements.length === 0) {
      requirements.push({
        id: "r1",
        text: trimmedJd.slice(0, 100),
        kind: "technical",
        priority: "must",
      });
    }

    return {
      title: extracted.title || "Software Engineer",
      seniority: extracted.seniority || "Experienced",
      responsibilities:
        Array.isArray(extracted.responsibilities) && extracted.responsibilities.length > 0
          ? extracted.responsibilities
          : [extracted.title || "Software engineering responsibilities"],
      requirements,
    };
  } catch (err: any) {
    console.warn(`[Extractor] Fallback triggered due to error: ${err.message}`);
    // Deterministic fallback for edge cases
    return {
      title: trimmedJd.split("\n")[0].slice(0, 80) || "Software Engineer",
      seniority: "Mid-Senior",
      responsibilities: ["Core engineering responsibilities"],
      requirements: [
        {
          id: "r1",
          text: trimmedJd.slice(0, 150),
          kind: "technical",
          priority: "must",
        },
      ],
    };
  }
}
