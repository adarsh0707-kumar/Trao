"use client";

import { useState } from "react";
import { Printer, Copy, Check, FileDown, BookOpen } from "lucide-react";
import type { KitAppendixA } from "@trao/shared";

interface PrintableCheatSheetProps {
  kit: KitAppendixA;
}

export function PrintableCheatSheet({ kit }: PrintableCheatSheetProps) {
  const [copied, setCopied] = useState(false);

  const mustReqs = kit.role.requirements.filter((r) => r.priority === "must");
  const techQuestions = kit.questions.filter(
    (q) => q.category === "technical" || q.category === "system-design"
  ).slice(0, 4);
  const behQuestions = kit.questions.filter((q) => q.category === "behavioural").slice(0, 2);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyMarkdown = () => {
    const md = `# Interview Cheat Sheet: ${kit.role.title} at ${kit.source.company}
**Date:** ${new Date().toLocaleDateString()}
**Location/Company URL:** ${kit.source.company_url}

---

## 1. Company Talking Points
- **Summary:** ${kit.company_brief.summary}
- **What They Do:** ${kit.company_brief.what_they_do}

---

## 2. Core Must-Have Requirements to Defend
${mustReqs.map((r) => `- **[${r.id}]** ${r.text}`).join("\n")}

---

## 3. High-Priority Technical & Architecture Questions
${techQuestions
  .map(
    (q, i) =>
      `### ${i + 1}. ${q.prompt} (Diff ${q.difficulty})\n**Key Points:** ${q.answer_outline}\n`
  )
  .join("\n")}

---

## 4. Behavioural Scenarios (STAR Method)
${behQuestions
  .map(
    (q, i) =>
      `### ${i + 1}. ${q.prompt}\n**Approach:** ${q.answer_outline}\n`
  )
  .join("\n")}
`;

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="flex items-center justify-between no-print border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-400" />
            Interview-Morning One-Pager
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            High-yield printable cheat sheet to review 15 minutes before the call
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-medium text-slate-300 hover:text-teal-400 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied Markdown!" : "Copy Markdown"}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-semibold transition-colors shadow-md shadow-teal-500/20"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print One-Pager</span>
          </button>
        </div>
      </div>

      {/* The Printable Page */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 print:bg-white print:text-black print:p-0 print:border-0">
        {/* Header */}
        <div className="border-b border-slate-800 print:border-gray-300 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs font-bold text-teal-400 print:text-gray-600 uppercase tracking-widest">
                PRE-INTERVIEW BRIEF
              </span>
              <h1 className="text-2xl font-black text-slate-100 print:text-black mt-1">
                {kit.role.title}
              </h1>
              <p className="text-sm text-slate-400 print:text-gray-600">
                {kit.source.company} · {kit.role.seniority} Level · {kit.schedule.days_available} Day Plan
              </p>
            </div>
            <div className="text-right text-xs text-slate-500 print:text-gray-500">
              Trao AI Prep Kit
            </div>
          </div>
        </div>

        {/* Section 1: Company Intelligence */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 print:text-black mb-2">
            1. Company Talking Points
          </h2>
          <div className="bg-slate-950/60 print:bg-gray-50 border border-slate-800/80 print:border-gray-200 rounded-xl p-4 text-xs leading-relaxed text-slate-300 print:text-black space-y-2">
            <p>
              <strong>Mission & Summary:</strong> {kit.company_brief.summary}
            </p>
            <p>
              <strong>What They Build:</strong> {kit.company_brief.what_they_do}
            </p>
          </div>
        </div>

        {/* Section 2: Core Must-Haves */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 print:text-black mb-2">
            2. Core Must-Have Competencies
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {mustReqs.map((r) => (
              <div
                key={r.id}
                className="p-2.5 rounded-lg bg-slate-950/40 print:bg-gray-50 border border-slate-800 print:border-gray-200 text-slate-300 print:text-black flex items-start gap-2"
              >
                <span className="font-mono font-bold text-teal-400 print:text-black">[{r.id}]</span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: High Yield Technical Questions */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 print:text-black mb-2">
            3. High-Yield Technical & Architecture Focus
          </h2>
          <div className="space-y-3">
            {techQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-3 rounded-xl bg-slate-950/60 print:bg-gray-50 border border-slate-800 print:border-gray-200 text-xs"
              >
                <div className="font-semibold text-slate-200 print:text-black mb-1">
                  {idx + 1}. {q.prompt}
                </div>
                <div className="text-slate-400 print:text-gray-700 text-[11px] leading-relaxed">
                  <strong>Rubric:</strong> {q.answer_outline}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Behavioural STAR Alignment */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-teal-400 print:text-black mb-2">
            4. Behavioral & Culture Alignment (STAR Format)
          </h2>
          <div className="space-y-2">
            {behQuestions.map((q, idx) => (
              <div
                key={q.id}
                className="p-3 rounded-xl bg-slate-950/60 print:bg-gray-50 border border-slate-800 print:border-gray-200 text-xs"
              >
                <div className="font-semibold text-slate-200 print:text-black mb-1">
                  {idx + 1}. {q.prompt}
                </div>
                <div className="text-slate-400 print:text-gray-700 text-[11px] leading-relaxed">
                  <strong>Expected Framework:</strong> {q.answer_outline}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
