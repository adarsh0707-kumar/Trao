import { Router } from "express";
import { optionalAuth, requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";
import { KitModel } from "../models/Kit.js";
import { runPipeline } from "../pipeline/loop.js";
import {
  mergeCategoryRegeneration,
  recalculateSchedule,
} from "../pipeline/builder.js";
import {
  generateCategoryQuestions,
  synthesizeCompanyBrief,
} from "../pipeline/generator.js";
import { crawlCompanySite } from "../pipeline/crawler.js";
import type { KitAppendixA, QuestionCategory } from "@trao/shared";

export const kitsRouter = Router();

// In-memory kits storage for development / tests when MongoDB is not active
const inMemoryKits = new Map<string, { id: string; userId?: string; data: KitAppendixA; updatedAt: string }>();

/**
 * GET /api/kits
 * List all kits for the authenticated user
 */
kitsRouter.get("/", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.user?.id;
  try {
    if (userId) {
      const dbKits = await KitModel.find({ userId }).sort({ updatedAt: -1 });
      const inMem = Array.from(inMemoryKits.values()).filter((k) => k.userId === userId);

      const allUserKits = [
        ...dbKits.map((k) => ({
          id: k._id.toString(),
          role: k.data.role.title,
          company: k.data.source.company,
          company_url: k.data.source.company_url,
          days: k.data.schedule.days_available,
          updatedAt: k.updatedAt,
        })),
        ...inMem.map((k) => ({
          id: k.id,
          role: k.data.role.title,
          company: k.data.source.company,
          company_url: k.data.source.company_url,
          days: k.data.schedule.days_available,
          updatedAt: k.updatedAt,
        })),
      ];
      res.json({ kits: allUserKits });
      return;
    }

    // For unauthenticated visitor, only return kits created in the current anonymous session
    const guestKits = Array.from(inMemoryKits.values())
      .filter((k) => !k.userId)
      .map((k) => ({
        id: k.id,
        role: k.data.role.title,
        company: k.data.source.company,
        company_url: k.data.source.company_url,
        days: k.data.schedule.days_available,
        updatedAt: k.updatedAt,
      }));
    res.json({ kits: guestKits });
  } catch (err: any) {
    res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/**
 * GET /api/kits/stream
 * Server-Sent Events (SSE) endpoint for real-time progress during generation
 */
kitsRouter.get("/stream", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { jd, company_url, days } = req.query;

  if (!jd || !company_url) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "jd and company_url are required" } });
    return;
  }

  // Set headers for SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent("progress", { step: "INIT", message: "Starting kit generation...", progressPercent: 5 });

    const kit = await runPipeline({
      jd: String(jd),
      companyUrl: String(company_url),
      days: Number(days) || 5,
      allowLocalUrls: true,
      onProgress: (evt) => {
        sendEvent("progress", evt);
      },
    });

    const kitId = `kit_${Date.now()}`;
    const userId = req.user?.id;

    // Persist to MongoDB or in-memory
    try {
      const doc = await KitModel.create({
        userId,
        status: "ready",
        data: kit,
      });
      sendEvent("complete", { kitId: doc._id.toString(), kit });
    } catch {
      inMemoryKits.set(kitId, { id: kitId, userId, data: kit, updatedAt: new Date().toISOString() });
      sendEvent("complete", { kitId, kit });
    }

    res.end();
  } catch (err: any) {
    sendEvent("error", { code: "GENERATION_FAILED", message: err.message });
    res.end();
  }
});

/**
 * POST /api/kits/generate
 * Standard non-streaming generation endpoint
 */
kitsRouter.post("/generate", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { jd, company_url, days } = req.body;
    if (!jd || !company_url) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "jd and company_url are required" } });
      return;
    }

    const kit = await runPipeline({
      jd,
      companyUrl: company_url,
      days: Number(days) || 5,
      allowLocalUrls: true,
    });

    const kitId = `kit_${Date.now()}`;
    const userId = req.user?.id;

    try {
      const doc = await KitModel.create({ userId, status: "ready", data: kit });
      res.status(201).json({ kitId: doc._id.toString(), kit });
      return;
    } catch {
      inMemoryKits.set(kitId, { id: kitId, userId, data: kit, updatedAt: new Date().toISOString() });
      res.status(201).json({ kitId, kit });
      return;
    }
  } catch (err: any) {
    res.status(500).json({ error: { code: "GENERATION_FAILED", message: err.message } });
  }
});

/**
 * GET /api/kits/:id
 */
kitsRouter.get("/:id", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = String(req.params.id);
  const currentUserId = req.user?.id;

  try {
    // Try MongoDB
    try {
      const doc = await KitModel.findById(id);
      if (doc) {
        if (doc.userId && doc.userId.toString() !== currentUserId) {
          res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this prep kit" } });
          return;
        }
        res.json({ id: doc._id.toString(), kit: doc.data });
        return;
      }
    } catch {
      // not a mongo id or db offline
    }

    const item = inMemoryKits.get(id);
    if (!item) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Prep kit not found" } });
      return;
    }

    if (item.userId && item.userId !== currentUserId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have access to this prep kit" } });
      return;
    }

    res.json({ id: item.id, kit: item.data });
  } catch (err: any) {
    res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/**
 * PUT /api/kits/:id
 * Saves user updates (inline edits, reordering, custom added cards/questions)
 */
kitsRouter.put("/:id", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = String(req.params.id);
  const { kit } = req.body;
  const currentUserId = req.user?.id;

  if (!kit) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "kit payload is required" } });
    return;
  }

  try {
    try {
      const existing = await KitModel.findById(id);
      if (existing && existing.userId && existing.userId.toString() !== currentUserId) {
        res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission to modify this kit" } });
        return;
      }
      await KitModel.findByIdAndUpdate(id, { data: kit, updatedAt: new Date() });
    } catch {
      // ignore mongo error
    }

    const item = inMemoryKits.get(id);
    if (item && item.userId && item.userId !== currentUserId) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "You do not have permission to modify this kit" } });
      return;
    }

    inMemoryKits.set(id, { id, userId: currentUserId, data: kit, updatedAt: new Date().toISOString() });
    res.json({ success: true, message: "Kit updated successfully" });
  } catch (err: any) {
    res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/**
 * POST /api/kits/:id/regenerate-section
 * Selective section regeneration with state preservation
 */
kitsRouter.post("/:id/regenerate-section", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = String(req.params.id);
  const { section, category } = req.body;

  let currentKit: KitAppendixA | null = null;
  try {
    const doc = await KitModel.findById(id);
    if (doc) currentKit = doc.data;
  } catch {
    // fallback
  }

  if (!currentKit) {
    const item = inMemoryKits.get(id);
    if (item) currentKit = item.data;
  }

  if (!currentKit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
    return;
  }

  try {
    if (section === "questions" && category) {
      // Regenerate question category while preserving user edits and pinned questions
      const incoming = await generateCategoryQuestions(
        category as QuestionCategory,
        currentKit.role.requirements,
        currentKit.company_brief.what_they_do,
        currentKit.questions.length
      );

      const mergedQuestions = mergeCategoryRegeneration(
        currentKit.questions,
        incoming,
        category as QuestionCategory
      );

      currentKit.questions = mergedQuestions;
      // Re-allocate schedule to account for updated questions
      currentKit.schedule = recalculateSchedule(
        mergedQuestions,
        currentKit.role.requirements,
        currentKit.schedule.days_available
      );
    } else if (section === "company_brief") {
      // Regenerate company brief
      const crawlResult = await crawlCompanySite(currentKit.source.company_url, { allowLocalUrls: true });
      const { brief } = await synthesizeCompanyBrief(
        currentKit.source.company_url,
        crawlResult.pages
      );
      currentKit.company_brief = brief;
    } else if (section === "schedule") {
      // Regenerate schedule
      currentKit.schedule = recalculateSchedule(
        currentKit.questions,
        currentKit.role.requirements,
        currentKit.schedule.days_available
      );
    }

    // Save updated kit
    try {
      await KitModel.findByIdAndUpdate(id, { data: currentKit });
    } catch {}
    inMemoryKits.set(id, { id, data: currentKit, updatedAt: new Date().toISOString() });

    res.json({ success: true, kit: currentKit });
  } catch (err: any) {
    res.status(500).json({ error: { code: "REGENERATION_FAILED", message: err.message } });
  }
});

/**
 * POST /api/kits/:id/practice
 * Records flashcard practice score and updates confidence
 */
kitsRouter.post("/:id/practice", optionalAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  const id = String(req.params.id);
  const { cardId, confidence } = req.body;

  let currentKit: KitAppendixA | null = null;
  try {
    const doc = await KitModel.findById(id);
    if (doc) currentKit = doc.data;
  } catch {}
  if (!currentKit) {
    const item = inMemoryKits.get(id);
    if (item) currentKit = item.data;
  }

  if (!currentKit) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Kit not found" } });
    return;
  }

  const card = currentKit.flashcards.find((c) => c.id === cardId);
  if (card) {
    card.confidence = Number(confidence) as any;
    card.lastPracticedAt = new Date().toISOString();
  }

  try {
    await KitModel.findByIdAndUpdate(id, { data: currentKit });
  } catch {}
  inMemoryKits.set(id, { id, data: currentKit, updatedAt: new Date().toISOString() });

  res.json({ success: true, card });
});
