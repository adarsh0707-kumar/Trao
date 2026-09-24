# API Specification & Data Contracts
## Project: Trao AI Interview Prep Kit
**Specification:** `FS-AI-INTERVIEW-01`

---

## 1. Appendix A: Kit Data Schema (Strict Contract)

Every generated kit must strictly conform to this JSON schema. Field names and data types are non-negotiable.

```typescript
export interface KitAppendixA {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string; // ISO 8601 string
    pages_used: string[];
  };
  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };
  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
}

export interface Requirement {
  id: string; // e.g. "r1", "r2"
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
}

export interface Question {
  id: string; // e.g. "q1", "q2"
  requirement_ids: string[]; // Must reference existing Requirement ids
  category: "technical" | "behavioural" | "system-design" | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  // Extended Builder Metadata (Preserved across section regenerations)
  isEdited?: boolean;
  isPinned?: boolean;
  origin?: "generated" | "user";
}

export interface Flashcard {
  id: string; // e.g. "f1", "f2"
  front: string;
  back: string;
  requirement_ids: string[];
  // Extended Practice Metadata
  confidence?: 1 | 2 | 3 | 4 | 5;
  lastPracticedAt?: string;
  isEdited?: boolean;
  isPinned?: boolean;
  origin?: "generated" | "user";
}

export interface DaySchedule {
  day: number; // 1 to N
  focus: string;
  question_ids: string[]; // Must reference valid Question ids
  minutes: number; // Integer minutes (e.g. 45, 60, 90)
}

export interface Schedule {
  days_available: number;
  days: DaySchedule[];
}
```

---

## 2. Appendix B: Batch Evaluation Contract (Mandatory CLI)

### 2.1 Invocation Syntax
```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

### 2.2 Input Schema (`cases.json`)
```json
[
  {
    "id": "case-01",
    "jd": "Senior Backend Engineer\n\nWe are looking for a Node.js and distributed systems engineer...",
    "company_url": "http://localhost:8099/acme/",
    "days": 5
  },
  {
    "id": "case-02",
    "jd": "Frontend Developer with React expertise...",
    "company_url": "https://posthog.com",
    "days": 3
  }
]
```

### 2.3 Output Schema (`kits.json`)
```json
{
  "version": "1.0",
  "generated_at": "2026-09-01T09:12:44Z",
  "kits": [
    {
      "id": "case-01",
      "status": "ok",
      "kit": {
        /* Full Appendix A Object */
      },
      "error": null
    },
    {
      "id": "case-04",
      "status": "failed",
      "kit": null,
      "error": {
        "code": "COMPANY_UNREACHABLE",
        "message": "Company site unreachable after 3 retries."
      }
    }
  ]
}
```

---

## 3. Web Application REST Endpoints

### 3.1 Authentication

#### `POST /api/auth/register`
- **Request Body**: `{ email: string, password: string, name?: string }`
- **Response `201`**: `{ user: { id: string, email: string, name: string }, token: string }`

#### `POST /api/auth/login`
- **Request Body**: `{ email: string, password: string }`
- **Response `200`**: `{ user: { id: string, email: string, name: string }, token: string }`

#### `GET /api/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response `200`**: `{ user: { id: string, email: string, name: string } }`

---

### 3.2 Kits Management & Real-Time Pipeline

#### `GET /api/kits`
- **Headers**: `Authorization: Bearer <token>`
- **Response `200`**: `KitSummary[]` (Lists all kits belonging to logged-in user)

#### `POST /api/kits/generate`
- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
  ```json
  {
    "jd": "string",
    "company_url": "string",
    "days": 5
  }
  ```
- **Response `202 Accepted`**: `{ kitId: string, streamUrl: "/api/kits/:id/events" }`

#### `GET /api/kits/:id/events` (Server-Sent Events)
Streams real-time pipeline status updates to the client:
```text
event: progress
data: {"step": "CRAWLING", "message": "Discovered /careers and /handbook links", "percent": 25}

event: progress
data: {"step": "EXTRACTION", "message": "Identified 6 must-have technical requirements", "percent": 45}

event: progress
data: {"step": "GAP_CHECK", "message": "Coverage gap detected for r3; running second-pass generator", "percent": 75}

event: complete
data: {"kitId": "65b...", "kit": { /* Appendix A */ }}
```

#### `GET /api/kits/:id`
- **Response `200`**: Full Kit document (Appendix A + builder & practice state)

#### `PUT /api/kits/:id`
- **Request Body**: Updated kit state (inline question edits, reordering, custom cards)
- **Response `200`**: `{ success: true, updated_at: string }`

#### `POST /api/kits/:id/regenerate-section`
- **Request Body**:
  ```json
  {
    "section": "questions",
    "category": "technical"
  }
  ```
- **Behavior**: Preserves all items with `isEdited: true`, `isPinned: true`, or `origin: "user"`. Only regenerates untouched generated questions.
- **Response `200`**: `{ kit: KitAppendixA }`

#### `POST /api/kits/:id/practice-card`
- **Request Body**:
  ```json
  {
    "cardId": "f1",
    "confidence": 4 // 1: Need Review, 2: Shaky, 3: Fair, 4: Good, 5: Mastered
  }
  ```
- **Response `200`**: `{ success: true, nextDue: string }`

---

## 4. Standard Error Codes

| Error Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired session token |
| `FORBIDDEN` | 403 | Attempting to access another user's kit |
| `NOT_FOUND` | 404 | Kit or resource does not exist |
| `SSRF_BLOCKED` | 400 | Target URL resolves to forbidden loopback/private IP |
| `COMPANY_UNREACHABLE` | 502 | Target company domain 404 or network timeout |
| `RATE_LIMIT_EXCEEDED` | 429 | LLM provider exhausted quota; backoff triggered |
| `SCHEMA_VALIDATION_ERROR`| 422 | Generated output failed strict Appendix A constraints |
