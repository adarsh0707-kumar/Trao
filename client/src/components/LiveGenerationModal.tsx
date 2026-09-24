"use client";

import { CheckCircle2, Loader2, AlertCircle, RefreshCw, Sparkles } from "lucide-react";

interface LiveGenerationModalProps {
  isOpen: boolean;
  currentStep: string;
  message: string;
  progressPercent: number;
  gapDetails?: string[];
  error?: string | null;
  onClose: () => void;
}

const PIPELINE_STEPS = [
  { key: "CRAWLING", label: "Researching Company & Culture" },
  { key: "JD_EXTRACTION", label: "Extracting Must vs Nice Requirements" },
  { key: "SYNTHESIS", label: "Synthesizing Brief & Hiring Insights" },
  { key: "QUESTION_GENERATION", label: "Generating Category Questions" },
  { key: "COVERAGE_CHECK", label: "Verifying Requirement Coverage" },
  { key: "SECOND_PASS", label: "Closing Gaps (Second Pass Loop)" },
  { key: "SCHEDULING", label: "Allocating Day-by-Day Schedule" },
];

export function LiveGenerationModal({
  isOpen,
  currentStep,
  message,
  progressPercent,
  gapDetails,
  error,
  onClose,
}: LiveGenerationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
            {error ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : progressPercent >= 100 ? (
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              {error ? "Generation Failed" : progressPercent >= 100 ? "Prep Kit Ready!" : "Synthesizing Your Kit"}
            </h3>
            <p className="text-xs text-slate-400">Autonomous research & deliberate multi-step pipeline</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5 mb-5">
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span className="truncate pr-2">{message || "Working..."}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                error ? "bg-red-500" : "bg-gradient-to-r from-teal-500 to-emerald-400"
              }`}
              style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
            />
          </div>
        </div>

        {/* Second pass notification banner if triggered */}
        {gapDetails && gapDetails.length > 0 && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
            <RefreshCw className="w-4 h-4 mt-0.5 shrink-0 animate-spin" />
            <div>
              <span className="font-semibold block">Second Pass Triggered</span>
              Coverage gap detected on {gapDetails.length} must-have requirements ({gapDetails.join(", ")}). Generating missing targeted questions...
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300">
            {error}
          </div>
        )}

        {/* Stepper list */}
        <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-1">
          {PIPELINE_STEPS.map((s, idx) => {
            const isCompleted =
              progressPercent >= 100 ||
              (idx < PIPELINE_STEPS.findIndex((item) => item.key === currentStep));
            const isCurrent = s.key === currentStep;

            return (
              <div
                key={s.key}
                className={`flex items-center gap-2.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                  isCurrent
                    ? "bg-slate-800 text-teal-300 font-medium border border-teal-800/40"
                    : isCompleted
                    ? "text-slate-400"
                    : "text-slate-600"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                ) : isCurrent ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400 shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-slate-700 shrink-0" />
                )}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Close/Dismiss button */}
        {(error || progressPercent >= 100) && (
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium text-sm transition-colors shadow-lg shadow-teal-500/20"
          >
            {error ? "Close" : "Open Your Prep Kit →"}
          </button>
        )}
      </div>
    </div>
  );
}
