"use client";

import { useState } from "react";
import { Calendar, Clock, CheckCircle2, Circle, ChevronRight } from "lucide-react";
import type { Schedule, Question } from "@trao/shared";
import { formatMinutes } from "@/lib/utils";

interface ScheduleTimelineProps {
  schedule: Schedule;
  questions: Question[];
}

export function ScheduleTimeline({ schedule, questions }: ScheduleTimelineProps) {
  const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());

  const toggleDayComplete = (dayNum: number) => {
    setCompletedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayNum)) next.delete(dayNum);
      else next.add(dayNum);
      return next;
    });
  };

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            Deterministic Study Schedule ({schedule.days_available} Days)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Arithmetically distributed across available days. Harder must-haves front-loaded earlier.
          </p>
        </div>
        <div className="text-xs text-teal-400 bg-teal-950/60 border border-teal-800/40 px-3 py-1 rounded-full font-medium">
          {completedDays.size} of {schedule.days.length} days completed
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {schedule.days.map((day) => {
          const isDone = completedDays.has(day.day);
          const dayQuestions = day.question_ids
            .map((qId) => questionMap.get(qId))
            .filter((q): q is Question => Boolean(q));

          return (
            <div
              key={day.day}
              className={`border rounded-2xl p-5 transition-all ${
                isDone
                  ? "bg-slate-950/40 border-slate-800/60 opacity-80"
                  : "bg-slate-900 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleDayComplete(day.day)}
                    className="text-slate-400 hover:text-teal-400 transition-colors"
                  >
                    {isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-teal-400" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-600 hover:text-slate-400" />
                    )}
                  </button>

                  <div>
                    <span className="text-[11px] font-bold text-teal-400 tracking-wider uppercase">
                      Day {day.day} of {schedule.days_available}
                    </span>
                    <h4
                      className={`text-sm font-semibold transition-colors ${
                        isDone ? "line-through text-slate-500" : "text-slate-100"
                      }`}
                    >
                      {day.focus}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-teal-400" />
                  <span>{formatMinutes(day.minutes)}</span>
                </div>
              </div>

              {/* Day's assigned questions */}
              <div className="pl-8 space-y-2 mt-2">
                {dayQuestions.map((q) => (
                  <div
                    key={q.id}
                    className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80"
                  >
                    <div className="flex items-center gap-2 pr-4 truncate">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                        {q.id}
                      </span>
                      <span className="truncate text-slate-200">{q.prompt}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          q.difficulty === 3
                            ? "text-red-400 bg-red-500/10"
                            : q.difficulty === 2
                            ? "text-amber-400 bg-amber-500/10"
                            : "text-emerald-400 bg-emerald-500/10"
                        }`}
                      >
                        Diff {q.difficulty}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
