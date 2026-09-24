"use client";

import { Activity, ShieldCheck, AlertTriangle, Sparkles, CheckCircle2 } from "lucide-react";
import type { KitAppendixA } from "@trao/shared";

interface ReadinessDiagnosticProps {
  kit: KitAppendixA;
}

export function ReadinessDiagnostic({ kit }: ReadinessDiagnosticProps) {
  const mustReqs = kit.role.requirements.filter((r) => r.priority === "must");
  const coveredMusts = mustReqs.filter(
    (r) => !kit.coverage.uncovered_requirement_ids.includes(r.id)
  );

  // 1. Requirement coverage score (out of 40)
  const coveragePercent = mustReqs.length > 0 ? (coveredMusts.length / mustReqs.length) * 100 : 100;
  const coverageScore = (coveragePercent / 100) * 40;

  // 2. Practice card score (out of 35)
  const totalCards = kit.flashcards.length;
  let masterySum = 0;
  kit.flashcards.forEach((c) => {
    masterySum += ((c.confidence || 0) / 5) * 100;
  });
  const cardMasteryPercent = totalCards > 0 ? Math.round(masterySum / totalCards) : 0;
  const practiceScore = (cardMasteryPercent / 100) * 35;

  // 3. Question breadth score (out of 25)
  const totalQuestions = kit.questions.length;
  const breadthScore = Math.min(25, totalQuestions * 3);

  // Overall readiness score (0 to 100%)
  const totalReadinessScore = Math.round(coverageScore + practiceScore + breadthScore);

  // Identify weak spots (e.g. unpracticed or low confidence cards)
  const weakSpots = kit.flashcards.filter((c) => (c.confidence || 0) < 3);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            Interview Readiness & Weak-Spots Diagnostic
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time score synthesized from must-have coverage, active recall practice, and question bank depth
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-400 block font-medium">Readiness Score</span>
            <span
              className={`text-2xl font-black ${
                totalReadinessScore >= 80
                  ? "text-emerald-400"
                  : totalReadinessScore >= 50
                  ? "text-amber-400"
                  : "text-rose-400"
              }`}
            >
              {totalReadinessScore}%
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center">
            {totalReadinessScore >= 80 ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <Sparkles className="w-6 h-6 text-teal-400" />
            )}
          </div>
        </div>
      </div>

      {/* Metric Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Must-Have Coverage</span>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-slate-100">
              {coveredMusts.length} / {mustReqs.length}
            </span>
            <span className="text-xs text-teal-400 font-semibold">{Math.round(coveragePercent)}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-teal-400 rounded-full transition-all"
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Flashcard Mastery</span>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-slate-100">{cardMasteryPercent}%</span>
            <span className="text-xs text-teal-400 font-semibold">{totalCards} cards</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all"
              style={{ width: `${cardMasteryPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <span className="text-xs text-slate-400 block mb-1">Question Bank Depth</span>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-slate-100">{totalQuestions} questions</span>
            <span className="text-xs text-teal-400 font-semibold">Ready</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: `${Math.min(100, totalQuestions * 10)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Identified Vulnerable Weak Spots */}
      {weakSpots.length > 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Targeted Review Suggested: {weakSpots.length} Low-Confidence Flashcards</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {weakSpots.slice(0, 4).map((c) => (
              <div
                key={c.id}
                className="text-xs p-2 rounded-lg bg-slate-950/60 border border-amber-500/20 text-slate-300 truncate"
              >
                <span className="text-amber-400 font-mono font-medium mr-1.5">[{c.id}]</span>
                {c.front}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>All flashcard topics have been reviewed with high confidence ratings!</span>
        </div>
      )}
    </div>
  );
}
