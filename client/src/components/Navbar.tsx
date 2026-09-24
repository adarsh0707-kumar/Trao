"use client";

import Link from "next/link";
import { Sparkles, Layers, LogIn, UserPlus, LogOut, User } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function Navbar() {
  const { user, logout } = useAuth();

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

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full">
                <User className="w-3.5 h-3.5 text-teal-400" />
                <span className="font-medium truncate max-w-[120px]">{user.name || user.email}</span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 px-2.5 py-1 rounded-lg border border-slate-800 hover:border-red-900/50 bg-slate-950 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="flex items-center gap-1 text-xs font-medium text-slate-300 hover:text-teal-400 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Log In</span>
              </Link>
              <Link
                href="/register"
                className="flex items-center gap-1 text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-teal-500/20"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Sign Up</span>
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
