# The AI Interview Prep Kit
> **Trao Full-Stack Engineering Assessment**  
> **Assessment ID:** `FS-AI-INTERVIEW-01`  
> **Author:** adarsh0707-kumar (`adarshku123456789@gmail.com`)

---

## 1. Project Overview & Chosen Tech Stack

The **AI Interview Prep Kit** is a web application that takes an arbitrary job description, target company website, and preparation window in days, autonomously researches the employer, and generates a personalized, structured interview preparation kit.

Unlike typical monolithic AI tools, this system implements a **deliberate, multi-step pipeline with deterministic guardrails**. Scheduling arithmetic and requirement coverage checks are strictly executed by deterministic algorithms in code, not handed to an LLM.

### Tech Stack Breakdown & Justifications

| Layer | Technology | Justification & Rationale |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 14 (App Router) + Tailwind CSS** | Provides fast server rendering, client-side optimistic interactivity for inline editing, and responsive layout for mobile & desktop. |
| **Backend** | **Node.js + Express + TypeScript** | Clean separation of concerns between HTTP routes, SSE progress streaming, and the core AI pipeline engine. |
| **Database** | **MongoDB + Mongoose** (with graceful in-memory fallback) | Flexible document model matching Appendix A hierarchical kits. Seamless offline resilience if MongoDB daemon is absent. |
| **Language** | **TypeScript (Strict Mode)** | Complete end-to-end type safety across shared schemas, server pipeline, and frontend components. |
| **Scraping** | **Custom Fetch + Cheerio + Robots-Parser** | Autonomous link discovery, SSRF protection, robots.txt compliance, and HTML sanitization capped at 2MB. |
| **LLM Tier** | **Google Gemini 2.5 Flash / Groq Llama 3.3 70B** | High quality on genuine free tiers; backed by token-bucket rate limiting (12 RPM) and exponential jitter backoff. |

---

## 2. Setup Instructions

### Prerequisites
- **Node.js:** v18+ (tested on v26)
- **npm:** v9+

### 2.1 Clone & Install
```bash
git clone https://github.com/adarsh0707-kumar/Trao.git
cd Trao
npm install
```

### 2.2 Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your free-tier LLM key in `.env`:
```ini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
# Optional alternatives
GROQ_API_KEY=
ALLOW_LOCAL_URLS=true
```
*(Note: If no API key is provided, the pipeline features a deterministic mock generator so evaluators can run the batch CLI out of the box in offline/unkeyed environments).*

### 2.3 Running the Mandatory Batch Entry Point (Section 9)
To evaluate cases without launching the web interface:
```bash
npm run evaluate -- --input cases.json --output kits.json
```
- **Input:** JSON array of `{ "id": string, "jd": string, "company_url": string, "days": number }`.
- **Output:** Conforms strictly to **Appendix B**, writing `{ "version": "1.0", "generated_at": "...", "kits": [...] }`.
- **Resilience:** Continues after individual case failures without aborting the run. Completes within the 15-minute budget.

### 2.4 Running the Web Application
Start both server and client concurrently:
```bash
npm run dev
```
- **Web Interface:** [http://localhost:3000](http://localhost:3000)
- **API Server:** [http://localhost:5000](http://localhost:5000)
- **Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

### 2.5 Running Automated Tests
```bash
npm test
```
Executes the Vitest test suite covering:
- Deterministic arithmetic schedule allocation across 1, 5, 14, 60 days
- Coverage gap analysis and second-pass triggers
- SSRF validation and robots.txt crawling
- Builder state preservation on category regeneration
- Appendix A schema adherence

---

## 3. High-Level Architecture & Pipeline Sequencing

The generation engine does not hand the entire problem to a single prompt. It executes deliberate, sequential steps:

```
[Job Description, Company URL, Days]
               │
               ▼
   1. SSRF & Security Validation
               │
               ▼
   2. Company Crawler & Link Discovery (robots.txt, /careers, /jobs, culture)
               │
               ▼
   3. JD Requirement Extraction (must vs nice, technical / behavioural / domain)
               │
               ▼
   4. Company Brief & Interview Insights Synthesis
               │
               ▼
   5. Category Question Generation (Separate targeted prompts per category)
               │
               ▼
   6. Active Recall Flashcard Generation
               │
               ▼
   7. DETERMINISTIC GAP CHECK (Code-level set difference: must-haves vs questions)
         │
         ├─► [Coverage Gaps Found & Pass < 2] ──► 8. SECOND PASS LOOP (Targeted gen)
         │                                                      │
         └───────────────────────◄──────────────────────────────┘
               │
               ▼
   9. DETERMINISTIC ARITHMETIC SCHEDULER (Allocates N days, front-loads difficulty)
               │
               ▼
   10. Appendix A Schema Validation (Zod)
               │
               ▼
        Verified Kit Output
```

### Why Deterministic Boundaries Matter
1. **Coverage Checking:** Handing coverage gap checks to an LLM leads to soft, subjective opinions. In our pipeline, `computeCoverageGaps()` runs in pure TypeScript code comparing `must` requirement IDs against question `requirement_ids`. If an ID is missing, it is a factual gap.
2. **Schedule Arithmetic:** LLMs are notorious for hallucinating day distributions, inventing float durations ("about 45 mins"), or drifting off requested day counts. Our `allocateSchedule()` algorithm arithmetically assigns integer minutes and places harder difficulty (difficulty 3) topics into earlier days.

---

## 4. The Hardest Problem: State Preservation in "The Builder"

Section 6 notes:
> *"Regenerating one section must not discard edits the user has made elsewhere, and a question the user wrote or edited by hand must survive a regeneration of its category... This is the hardest state problem in the assessment and we will look closely at how you solved it."*

### How We Solved It
Every question in the system carries state metadata:
```typescript
interface StatefulQuestion {
  id: string;
  isEdited?: boolean;    // Set true when user modifies prompt or answer inline
  isPinned?: boolean;    // Set true when user locks the question
  origin?: "generated" | "user"; // "user" if added by hand, "generated" if by AI
}
```

When the user clicks **"Regenerate Category"** (e.g. `technical`):
1. **Isolation:** Questions in other categories (`system-design`, `behavioural`, `company-fit`) are completely untouched.
2. **Partitioning:** The target category is partitioned into:
   - **Protected Items:** `{ isPinned: true }` OR `{ isEdited: true }` OR `{ origin: "user" }`.
   - **Replaceable Items:** Untouched AI generated questions.
3. **Deduplication & Merge:** Newly generated questions are deduplicated against protected questions by prompt similarity.
4. **Reassembly:** The category is reconstructed as `[...protectedItems, ...freshIncomingQuestions]`.
5. **Schedule Re-alignment:** The schedule is arithmetically updated to reference the new question pool while keeping existing scheduled items intact.

---

## 5. Retrieval Approach & Sources Used

1. **Link Discovery Heuristic:**
   - Normalizes domain, fetches `robots.txt`, and parses allow/disallow rules.
   - Crawls homepage and scores discovered internal links based on hiring and culture keywords:
     - High priority: `careers`, `jobs`, `hiring`, `interview`, `work-with-us`, `positions`.
     - Medium priority: `handbook`, `culture`, `values`, `about`, `engineering`, `blog`.
   - Fetches the top 3 highest-scoring subpages (capped at 2MB per page, 6s timeout).
2. **Public Discussion Enrichment:**
   - Queries public discussion summaries regarding the company's interview rounds (e.g., take-home vs live coding vs system design).
3. **Honest Reporting:**
   - If a company website lacks a careers page or returns 404, the system records this honestly in `company_brief` instead of inventing false interview stages.

---

## 6. Edge Cases & Resilience Matrix (Section 10)

| Edge Case | Strategy & Defense |
| :--- | :--- |
| **Invalid URL, 404, or Timeout** | Crawler catches network error, records failure in `pages_used` / warnings, and falls back to JD-only synthesis without crashing. |
| **No Discoverable Hiring Page** | Synthesizes an honest company brief stating that no public hiring criteria were found; bases technical prep on industry standards. |
| **Two-Line Stub Job Description** | Strict extraction prompts extract only stated requirements. Zero hallucinated technologies. Thin input produces a thin, honest kit. |
| **No Public Interview Discussion** | Skips discussion enrichment; sets interview insights to standard technical evaluation. |
| **LLM Provider Rate Limiting (429/TPM)** | Sliding-window throttler (12 RPM) + exponential backoff with jitter ($\min(2^{\text{attempt}} \times 1.5\text{s} + \text{jitter}, 30\text{s})$). |
| **Malformed JSON Returned by LLM** | Multi-tier parser strips markdown fences, repairs trailing commas, and extracts balanced bracket objects. |
| **Duplicate Submissions** | Deterministic ID assignment and hash checks allow cache reuse or fresh regeneration. |
| **1-Day vs 60-Day Schedules** | **1-day:** Allocates high-priority must-haves into a focused intensive session. **60-day:** Paces foundational mastery, spaced repetition recap, and behavioural refinement. |

---

## 7. Security Safeguards (Section 11)

- **SSRF Protection:** In production (`NODE_ENV === 'production'`), resolves DNS and rejects loopback (`127.0.0.1`, `::1`), private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), and cloud metadata IPs (`169.254.169.254`). Local addresses are permitted only during batch evaluation with `ALLOW_LOCAL_URLS=true`.
- **Payload Limits:** Maximum 2MB per scraped page, 8,000 character context truncation per page.
- **Prompt Injection Quarantine:** Crawled HTML is treated strictly as untrusted data within `<untrusted_scraped_content>` delimiters, with explicit system instructions forbidding instruction following from crawled content.

---

## 8. Creative Feature: Readiness Diagnostic & One-Click Cheat Sheet

To address real problems candidates face:
1. **Interactive Readiness Score (0-100%):**
   - Synthesizes coverage of must-haves (40%), flashcard mastery from active recall ratings (35%), and question bank depth (25%).
   - Flags low-confidence topics as **Vulnerable Weak Spots** to review in the final 24 hours.
2. **One-Click Printable Cheat Sheet:**
   - Single-page condensed overview with `@media print` styling and **Copy as Markdown** button.
   - Gives candidates their company talking points, architecture rubrics, and STAR behavioural answers 15 minutes before the interview.

---

## 9. Submission Deliverables Checklist
- [x] **Repository:** Public source code with meaningful commit history.
- [x] **Batch Entry Point:** `npm run evaluate -- --input <cases.json> --output <kits.json>` fully verified from clean clone.
- [x] **Appendix A Schema:** 100% compliant with strict Zod validation.
- [x] **Appendix B Output:** Verified output file shape.
- [x] **The Builder:** Inline editing, reordering, pin/unpin, and edit-preserving category regeneration.
- [x] **Practice Mode:** Flashcard flip deck with confidence tracking and adaptive queue.
- [x] **Deterministic Schedule:** Pure arithmetic day allocation front-loading difficulty.
- [x] **Automated Tests:** 18 unit tests passing across 5 test suites.
