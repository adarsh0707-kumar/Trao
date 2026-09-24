"use client";

import { useState, useEffect } from "react";
import {
  RotateCcw,
  Sparkles,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Award,
  CheckCircle,
  Clock,
  Layers,
} from "lucide-react";
import type { Flashcard } from "@trao/shared";
import { recordPracticeCard } from "@/lib/api";

interface FlashcardDeckProps {
  kitId: string;
  flashcards: Flashcard[];
  onUpdateFlashcard: (cardId: string, confidence: number) => void;
}

export function FlashcardDeck({ kitId, flashcards, onUpdateFlashcard }: FlashcardDeckProps) {
  // Sort cards by confidence ascending: unpracticed first, then least confident (adaptive queue)
  const sortedCards = [...flashcards].sort((a, b) => {
    const confA = a.confidence ?? 0;
    const confB = b.confidence ?? 0;
    return confA - confB;
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [completedInSession, setCompletedInSession] = useState<Set<string>>(new Set());

  const currentCard: Flashcard | undefined = sortedCards[currentIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleRate = async (confidence: number) => {
    if (!currentCard) return;
    onUpdateFlashcard(currentCard.id, confidence);
    setCompletedInSession((prev) => new Set(prev).add(currentCard.id));
    recordPracticeCard(kitId, currentCard.id, confidence).catch(console.error);

    // Advance to next card
    if (currentIndex < sortedCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      setIsFlipped(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleFlip();
      } else if (["1", "2", "3", "4", "5"].includes(e.key) && isFlipped) {
        handleRate(Number(e.key));
      } else if (e.key === "ArrowRight") {
        if (currentIndex < sortedCards.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          setIsFlipped(false);
        }
      } else if (e.key === "ArrowLeft") {
        if (currentIndex > 0) {
          setCurrentIndex((prev) => prev - 1);
          setIsFlipped(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFlipped, currentIndex, sortedCards.length, currentCard]);

  if (sortedCards.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <Layers className="w-8 h-8 text-slate-500 mx-auto mb-2" />
        <p className="text-sm text-slate-400">No flashcards available in this kit.</p>
      </div>
    );
  }

  const practicedCount = flashcards.filter((c) => (c.confidence ?? 0) > 0).length;
  const progressPercent = Math.round((practicedCount / flashcards.length) * 100);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Session Progress Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <span className="text-xs text-slate-400 font-medium">Practice Mastery</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-lg font-bold text-slate-100">
              {practicedCount} / {flashcards.length} cards covered
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 font-semibold border border-teal-500/30">
              {progressPercent}%
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
            Card {currentIndex + 1} of {sortedCards.length}
          </span>
        </div>
      </div>

      {/* The Flashcard Flip Deck */}
      <div
        onClick={handleFlip}
        className={`relative min-h-[300px] cursor-pointer rounded-2xl p-8 transition-all duration-300 border shadow-xl flex flex-col justify-between select-none ${
          isFlipped
            ? "bg-slate-900 border-teal-500/50 shadow-teal-500/5"
            : "bg-slate-900 border-slate-800 hover:border-slate-700"
        }`}
      >
        {/* Top Card Badge */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="font-mono text-teal-400 font-semibold">{currentCard.id}</span>
          <span className="flex items-center gap-1.5 text-slate-400">
            {isFlipped ? <Eye className="w-3.5 h-3.5 text-teal-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            {isFlipped ? "Showing Answer" : "Click or Press Space to Reveal"}
          </span>
        </div>

        {/* Card Content */}
        <div className="py-6 text-center">
          {isFlipped ? (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider block">
                Answer / Core Principle
              </span>
              <p className="text-base sm:text-lg text-slate-100 leading-relaxed font-normal">
                {currentCard.back}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Prompt / Concept
              </span>
              <h3 className="text-lg sm:text-xl font-medium text-slate-100 leading-snug">
                {currentCard.front}
              </h3>
            </div>
          )}
        </div>

        {/* Bottom Requirement Reference */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-800/80 pt-3">
          <span>Targeting: {currentCard.requirement_ids?.join(", ") || "General"}</span>
          {currentCard.confidence ? (
            <span className="text-teal-400">
              Confidence Level: {currentCard.confidence}/5
            </span>
          ) : (
            <span>Not yet rated</span>
          )}
        </div>
      </div>

      {/* Confidence Rating Bar (Enabled when card is flipped) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
        <p className="text-xs text-slate-400 text-center mb-3">
          {isFlipped
            ? "How well did you know this concept? (Keys 1 - 5)"
            : "Reveal the answer to rate your confidence"}
        </p>

        <div className="grid grid-cols-5 gap-2">
          {[
            { level: 1, label: "Need Review", color: "hover:bg-red-500 hover:text-white" },
            { level: 2, label: "Shaky", color: "hover:bg-amber-500 hover:text-white" },
            { level: 3, label: "Fair", color: "hover:bg-yellow-500 hover:text-slate-950" },
            { level: 4, label: "Good", color: "hover:bg-emerald-500 hover:text-white" },
            { level: 5, label: "Mastered", color: "hover:bg-teal-500 hover:text-slate-950" },
          ].map((btn) => (
            <button
              key={btn.level}
              type="button"
              disabled={!isFlipped}
              onClick={(e) => {
                e.stopPropagation();
                handleRate(btn.level);
              }}
              className={`py-2 px-1 rounded-xl border border-slate-800 bg-slate-950 text-xs font-medium text-slate-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${btn.color}`}
            >
              <span className="block text-sm font-bold">{btn.level}</span>
              <span className="text-[10px] hidden sm:block truncate">{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-2">
        <button
          type="button"
          onClick={() => {
            if (currentIndex > 0) {
              setCurrentIndex((prev) => prev - 1);
              setIsFlipped(false);
            }
          }}
          disabled={currentIndex === 0}
          className="flex items-center gap-1 hover:text-slate-200 disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        <span className="text-[11px] text-slate-500">
          Prioritized by lowest confidence (adaptive recall queue)
        </span>

        <button
          type="button"
          onClick={() => {
            if (currentIndex < sortedCards.length - 1) {
              setCurrentIndex((prev) => prev + 1);
              setIsFlipped(false);
            }
          }}
          disabled={currentIndex === sortedCards.length - 1}
          className="flex items-center gap-1 hover:text-slate-200 disabled:opacity-30"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
