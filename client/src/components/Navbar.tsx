"use client";

import Link from "next/link";
import { Sparkles, Terminal, BookOpen, Layers } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-lg text-slate-100 tracking-tight flex items-center gap-1.5">
              Trao <span className="text-teal-400 font-medium text-xs px-2 py-0.5 rounded-full bg-teal-950/60 border border-teal-800/40">Prep Kit</span>
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-slate-400">
          <Link
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
          >
            <Layers className="w-4 h-4 text-teal-400" />
            Dashboard
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>FS-AI-INTERVIEW-01</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
