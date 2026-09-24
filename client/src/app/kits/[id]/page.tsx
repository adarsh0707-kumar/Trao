"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  BookOpen,
  Printer,
  Activity,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import type { KitAppendixA } from "@trao/shared";
import { fetchKitById } from "@/lib/api";
import { CompanyBriefCard } from "@/components/CompanyBriefCard";
import { KitBuilder } from "@/components/KitBuilder";
import { FlashcardDeck } from "@/components/FlashcardDeck";
import { ScheduleTimeline } from "@/components/ScheduleTimeline";
import { ReadinessDiagnostic } from "@/components/ReadinessDiagnostic";
import { PrintableCheatSheet } from "@/components/PrintableCheatSheet";

export default function KitDetailPage() {
  const params = useParams();
  const router = useRouter();
  const kitId = String(params.id);

  const [kit, setKit] = useState<KitAppendixA | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "builder" | "practice" | "schedule" | "cheatsheet"
  >("builder");

  useEffect(() => {
    fetchKitById(kitId)
      .then((res) => {
        setKit(res.kit);
      })
      .catch((err) => {
        setError(err.message || "Kit not found");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [kitId]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-2 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading interview prep kit...</p>
      </div>
    );
  }

  if (error || !kit) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-sm text-red-400">{error || "Kit not found"}</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:underline"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const handleUpdateFlashcard = (cardId: string, confidence: number) => {
    setKit((prev) => {
      if (!prev) return prev;
      const updatedCards = prev.flashcards.map((c) =>
        c.id === cardId ? { ...c, confidence: confidence as any } : c
      );
      return { ...prev, flashcards: updatedCards };
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Title */}
      <div className="no-print">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-teal-400 transition-colors mb-3"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Prep Kits
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <span className="font-semibold text-teal-400 uppercase tracking-wider">
                {kit.source.company}
              </span>
              <span>·</span>
              <span>{kit.role.seniority}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {kit.schedule.days_available} days prep
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              {kit.role.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
              {kit.questions.length} Questions · {kit.flashcards.length} Cards
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 overflow-x-auto no-print">
        {[
          { key: "builder", label: "The Builder", icon: Sliders },
          { key: "practice", label: "Practice Mode", icon: Layers },
          { key: "schedule", label: "Schedule", icon: Calendar },
          { key: "overview", label: "Overview & Diagnostic", icon: Activity },
          { key: "cheatsheet", label: "Printable Cheat Sheet", icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? "border-teal-400 text-teal-400 bg-slate-900/40"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="pt-2">
        {activeTab === "builder" && (
          <KitBuilder
            kitId={kitId}
            kit={kit}
            onKitUpdate={(updatedKit) => setKit(updatedKit)}
          />
        )}

        {activeTab === "practice" && (
          <FlashcardDeck
            kitId={kitId}
            flashcards={kit.flashcards}
            onUpdateFlashcard={handleUpdateFlashcard}
          />
        )}

        {activeTab === "schedule" && (
          <ScheduleTimeline schedule={kit.schedule} questions={kit.questions} />
        )}

        {activeTab === "overview" && (
          <div className="space-y-6">
            <ReadinessDiagnostic kit={kit} />
            <CompanyBriefCard
              kitId={kitId}
              source={kit.source}
              brief={kit.company_brief}
              role={kit.role}
              onUpdateKit={(updatedKit) => setKit(updatedKit)}
            />
          </div>
        )}

        {activeTab === "cheatsheet" && <PrintableCheatSheet kit={kit} />}
      </div>
    </div>
  );
}
