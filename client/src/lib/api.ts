import type { KitAppendixA, QuestionCategory } from "@trao/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("trao_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchKits(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/kits`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error("Failed to load prep kits");
  const data = await res.json();
  return data.kits || [];
}

export async function fetchKitById(id: string): Promise<{ id: string; kit: KitAppendixA }> {
  const res = await fetch(`${API_BASE}/kits/${id}`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error("Prep kit not found");
  return res.json();
}

export async function saveKit(id: string, kit: KitAppendixA): Promise<void> {
  const res = await fetch(`${API_BASE}/kits/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ kit }),
  });
  if (!res.ok) throw new Error("Failed to save changes");
}

export async function regenerateSection(
  id: string,
  section: "questions" | "company_brief" | "schedule",
  category?: QuestionCategory
): Promise<{ success: boolean; kit: KitAppendixA }> {
  const res = await fetch(`${API_BASE}/kits/${id}/regenerate-section`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ section, category }),
  });
  if (!res.ok) throw new Error("Failed to regenerate section");
  return res.json();
}

export async function recordPracticeCard(
  kitId: string,
  cardId: string,
  confidence: number
): Promise<void> {
  await fetch(`${API_BASE}/kits/${kitId}/practice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
    body: JSON.stringify({ cardId, confidence }),
  });
}

export function subscribeKitGeneration(
  jd: string,
  companyUrl: string,
  days: number,
  onProgress: (data: any) => void,
  onComplete: (kitId: string, kit: KitAppendixA) => void,
  onError: (err: any) => void
): () => void {
  const params = new URLSearchParams({
    jd,
    company_url: companyUrl,
    days: String(days),
  });

  const eventSource = new EventSource(`${API_BASE}/kits/stream?${params.toString()}`);

  eventSource.addEventListener("progress", (e) => {
    try {
      const data = JSON.parse(e.data);
      onProgress(data);
    } catch {}
  });

  eventSource.addEventListener("complete", (e) => {
    try {
      const data = JSON.parse(e.data);
      onComplete(data.kitId, data.kit);
    } catch {}
    eventSource.close();
  });

  eventSource.addEventListener("error", (e: any) => {
    try {
      const data = JSON.parse(e.data);
      onError(data);
    } catch {
      onError({ message: "Connection to generation stream closed or failed" });
    }
    eventSource.close();
  });

  return () => {
    eventSource.close();
  };
}
