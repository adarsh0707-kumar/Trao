"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Calendar, Globe, Building2, Plus, Clock } from "lucide-react";
import { KitIntakeForm } from "@/components/KitIntakeForm";
import { fetchKits } from "@/lib/api";

export default function HomePage() {
  const [kits, setKits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKits()
      .then((data) => setKits(data))
      .catch(() => setKits([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-12">
      {/* Hero header */}
      <div className="text-center max-w-2xl mx-auto space-y-3 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Autonomous Research & Arithmetic Scheduling</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Turn Any Job Description into an{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
            Interview Prep Kit
          </span>
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Autonomous company crawling, requirement extraction, category-specific question banking, and mathematical study schedule allocation.
        </p>
      </div>

      {/* Intake Section */}
      <KitIntakeForm />

      {/* Existing Kits List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <h2 className="text-base font-semibold text-slate-200 flex items-center gap-2">
            <span>Your Prep Kits</span>
            <span className="text-xs font-normal text-slate-500">({kits.length})</span>
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : kits.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
            <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-400">No kits generated yet</p>
            <p className="text-xs text-slate-500 mt-1">Paste a job description above to generate your first kit</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kits.map((kit) => (
              <Link
                key={kit.id}
                href={`/kits/${kit.id}`}
                className="group bg-slate-900 border border-slate-800 hover:border-teal-500/40 rounded-2xl p-5 transition-all hover:shadow-xl hover:shadow-teal-500/5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="truncate font-medium text-teal-400">{kit.company}</span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {kit.days} days
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-100 group-hover:text-teal-300 transition-colors line-clamp-1">
                    {kit.role}
                  </h3>
                </div>

                <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-800/80 text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-[11px] text-slate-500 truncate max-w-[150px]">
                    <Globe className="w-3 h-3 shrink-0" />
                    {kit.company_url.replace(/^https?:\/\//, "")}
                  </span>
                  <span className="text-teal-400 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-1 text-xs">
                    Open Kit <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
