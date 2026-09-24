import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Token-bucket sliding window rate limiter
 * Enforces rate limits for free tiers (e.g., max 12 requests per minute to stay safe within 15 RPM).
 */
class RateLimiter {
  private timestamps: number[] = [];
  private maxPerMinute: number;

  constructor(maxPerMinute: number = 12) {
    this.maxPerMinute = maxPerMinute;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    // Keep only timestamps within the last 60 seconds
    this.timestamps = this.timestamps.filter((ts) => now - ts < 60000);

    if (this.timestamps.length >= this.maxPerMinute) {
      const oldest = this.timestamps[0];
      const waitTime = 60000 - (now - oldest) + 500; // Wait until oldest falls out + 500ms jitter
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.timestamps.push(Date.now());
  }
}

const rateLimiter = new RateLimiter(12);

/**
 * Cleans and repairs JSON strings returned by LLMs
 */
export function extractAndParseJSON<T = any>(rawText: string): T {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "");
  }

  // Find first { or [ and last } or ]
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  let startIndex = 0;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) {
      cleaned = cleaned.slice(startIndex, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
    const lastBracket = cleaned.lastIndexOf("]");
    if (lastBracket !== -1) {
      cleaned = cleaned.slice(startIndex, lastBracket + 1);
    }
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    // Attempt basic trailing comma removal
    const trailingCommaFixed = cleaned.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(trailingCommaFixed) as T;
    } catch {
      throw new Error(`Failed to parse JSON from LLM response: ${err.message}\nRaw Text:\n${rawText.slice(0, 500)}...`);
    }
  }
}

/**
 * Resilient multi-provider LLM Client
 * Defaults to Google Gemini free tier, with support for Groq and exponential backoff
 */
export class ResilientLLMClient {
  private geminiClient: GoogleGenerativeAI | null = null;
  private provider: string;

  constructor() {
    this.provider = (process.env.LLM_PROVIDER || "gemini").toLowerCase();
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "your_gemini_api_key_here") {
      this.geminiClient = new GoogleGenerativeAI(apiKey);
    }
  }

  async generateText(
    prompt: string,
    options: LLMOptions = {},
    systemInstruction?: string
  ): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        await rateLimiter.acquire();

        // 1. Google Gemini Provider
        if (this.geminiClient) {
          const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
          const model = this.geminiClient.getGenerativeModel({
            model: modelName,
            systemInstruction: systemInstruction || undefined,
            generationConfig: {
              temperature: options.temperature ?? 0.2,
              responseMimeType: options.jsonMode ? "application/json" : undefined,
            },
          });

          const result = await model.generateContent(prompt);
          const response = result.response;
          const text = response.text();
          if (!text) throw new Error("Empty response returned by Gemini model");
          return text;
        }

        // 2. Groq or OpenAI-compatible Fallback
        const groqKey = process.env.GROQ_API_KEY;
        if (groqKey) {
          const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${groqKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
              messages: [
                ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
                { role: "user", content: prompt },
              ],
              temperature: options.temperature ?? 0.2,
              response_format: options.jsonMode ? { type: "json_object" } : undefined,
            }),
          });

          if (!groqRes.ok) {
            const errBody = await groqRes.text();
            throw new Error(`Groq API error ${groqRes.status}: ${errBody}`);
          }

          const data = (await groqRes.json()) as any;
          return data.choices[0].message.content;
        }

        // 3. Fallback mock generator when no API key is provided
        // Ensures `npm run evaluate` and tests run out of the box in offline/unkeyed environments
        return this.getMockResponse(prompt);
      } catch (err: any) {
        attempt++;
        const isRateLimit =
          err.message?.includes("429") ||
          err.message?.includes("RESOURCE_EXHAUSTED") ||
          err.message?.includes("slow down");

        if (attempt <= maxRetries && isRateLimit) {
          const backoffDelay = Math.min(2000 * Math.pow(2, attempt) + Math.random() * 1000, 30000);
          console.warn(`[LLM] Rate limit hit. Backing off for ${Math.round(backoffDelay)}ms (Attempt ${attempt}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, backoffDelay));
        } else if (attempt <= maxRetries) {
          console.warn(`[LLM] Request failed: ${err.message}. Retrying in 2s (Attempt ${attempt}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          throw err;
        }
      }
    }

    throw new Error("Exhausted all LLM retry attempts");
  }

  async generateJSON<T = any>(
    prompt: string,
    options: LLMOptions = {},
    systemInstruction?: string
  ): Promise<T> {
    const rawText = await this.generateText(prompt, { ...options, jsonMode: true }, systemInstruction);
    return extractAndParseJSON<T>(rawText);
  }

  /**
   * Deterministic mock generator for offline testing or when keys are absent
   */
  private getMockResponse(prompt: string): string {
    if (prompt.includes("extract the requirements")) {
      return JSON.stringify({
        title: "Software Engineer",
        seniority: "Mid-Senior",
        responsibilities: [
          "Design and build reliable web services",
          "Collaborate with cross-functional product teams",
        ],
        requirements: [
          { id: "r1", text: "Proficiency with TypeScript and Node.js", kind: "technical", priority: "must" },
          { id: "r2", text: "Experience with relational or NoSQL databases", kind: "technical", priority: "must" },
          { id: "r3", text: "Effective communication and peer code reviews", kind: "behavioural", priority: "must" },
          { id: "r4", text: "Familiarity with Docker and containerization", kind: "technical", priority: "nice" },
        ],
      });
    }

    if (prompt.includes("Synthesize an honest company brief")) {
      return JSON.stringify({
        summary: "Modern software enterprise developing developer tooling and scalable infrastructure.",
        what_they_do: "Cloud platforms, developer workflows, and automated pipeline tooling.",
        interview_insights: "Technical screening followed by system architecture discussion and values assessment.",
      });
    }

    if (prompt.includes("Generate targeted questions")) {
      return JSON.stringify({
        questions: [
          {
            id: "q1",
            requirement_ids: ["r1"],
            category: "technical",
            prompt: "Explain how Node.js event loop handles non-blocking I/O operations.",
            answer_outline: "Discuss libuv, epoll/kqueue event demultiplexer, phases of the event loop...",
            difficulty: 2,
          },
          {
            id: "q2",
            requirement_ids: ["r2"],
            category: "system-design",
            prompt: "How do you optimize slow database queries and manage indexes effectively?",
            answer_outline: "Explain EXPLAIN query plans, B-Tree indexes, compound index prefixing...",
            difficulty: 3,
          },
          {
            id: "q3",
            requirement_ids: ["r3"],
            category: "behavioural",
            prompt: "Tell me about a time you disagreed with a colleague during a code review and how you reached consensus.",
            answer_outline: "STAR structure: Focus on constructive technical rationale, objective benchmarks, and team harmony...",
            difficulty: 1,
          },
        ],
      });
    }

    if (prompt.includes("Generate active recall flashcards")) {
      return JSON.stringify({
        flashcards: [
          {
            id: "f1",
            front: "What is the single-threaded nature of Node.js and where is multi-threading used?",
            back: "V8 JavaScript engine runs on a single main thread, while libuv manages a background worker thread pool for file I/O, crypto, and DNS.",
            requirement_ids: ["r1"],
          },
          {
            id: "f2",
            front: "When should you use a composite index in a database?",
            back: "When queries frequently filter or sort across multiple columns together; ordering of columns matters (left-to-right rule).",
            requirement_ids: ["r2"],
          },
        ],
      });
    }

    return "{}";
  }
}

export const llmClient = new ResilientLLMClient();
