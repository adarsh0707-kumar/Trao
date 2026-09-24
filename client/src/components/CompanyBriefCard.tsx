"use client";

import { useState } from "react";
import { Building2, ExternalLink, RefreshCw, Briefcase, CheckCircle2, Star } from "lucide-react";
import type { CompanyBrief, RoleInfo, SourceInfo, KitAppendixA } from "@trao/shared";
import { regenerateSection } from "@/lib/api";

interface CompanyBriefCardProps {
  kitId: string;
  source: SourceInfo;
  brief: CompanyBrief;
  role: RoleInfo;
  onUpdateKit: (kit: KitAppendixA) => void;
}

export function CompanyBriefCard({
  kitId,
  source,
  brief,
  role,
  onUpdateKit,
}: CompanyBriefCardProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerateBrief = async () => {
    setIsRegenerating(true);
    try {
      const res = await regenerateSection(kitId, "company_brief");
      if (res.success && res.kit) {
        onUpdateKit(res.kit);
      }
    } catch (err: any) {
      alert(`Failed to regenerate brief: ${err.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  const mustReqs = role.requirements.filter((r) => r.priority === "must");
  const niceReqs = role.requirements.filter((r) => r.priority === "nice");

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="font-semibold text-teal-400 uppercase tracking-wider">{role.seniority}</span>
            <span>·</span>
            <span>{source.company}</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">{role.title}</h2>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={source.company_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-400 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 transition-colors"
          >
            <span>Visit Site</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            type="button"
            disabled={isRegenerating}
            onClick={handleRegenerateBrief}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-teal-400 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 transition-colors disabled:opacity-50"
            title="Re-crawl and synthesize fresh company brief"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin text-teal-400" : ""}`} />
            <span>Regenerate Brief</span>
          </button>
        </div>
      </div>

      {/* Brief details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-teal-400" />
            Company Overview & Summary
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            {brief.summary}
          </p>

          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pt-2">
            What They Do
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            {brief.what_they_do}
          </p>
        </div>

        {/* Requirements extraction breakdown */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-teal-400" />
            Extracted Requirements ({role.requirements.length})
          </h3>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {/* Must-haves */}
            {mustReqs.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs"
              >
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400 font-semibold shrink-0">
                  {r.id}
                </span>
                <div className="flex-1">
                  <span className="text-slate-200">{r.text}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-semibold text-teal-400 uppercase tracking-wider">
                      MUST
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">{r.kind}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Nice-to-haves */}
            {niceReqs.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs opacity-75"
              >
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold shrink-0">
                  {r.id}
                </span>
                <div className="flex-1">
                  <span className="text-slate-300">{r.text}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                      NICE TO HAVE
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">{r.kind}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pages Crawled Citation */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500">
        <span>Researched at {new Date(source.researched_at).toLocaleDateString()}</span>
        <span>Sources: {source.pages_used?.join(", ") || source.company_url}</span>
      </div>
    </div>
  );
}
