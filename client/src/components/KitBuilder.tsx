"use client";

import { useState } from "react";
import {
  Pin,
  Edit3,
  Trash2,
  Plus,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Check,
  ChevronDown,
  ChevronRight,
  Shield,
  HelpCircle,
} from "lucide-react";
import type { Question, QuestionCategory, KitAppendixA } from "@trao/shared";
import { regenerateSection, saveKit } from "@/lib/api";

interface KitBuilderProps {
  kitId: string;
  kit: KitAppendixA;
  onKitUpdate: (updatedKit: KitAppendixA) => void;
}

const CATEGORIES: { key: QuestionCategory; label: string; desc: string }[] = [
  { key: "technical", label: "Technical & Algorithms", desc: "Core languages, frameworks, and patterns" },
  { key: "system-design", label: "System Design & Architecture", desc: "Scalability, storage, and state handling" },
  { key: "behavioural", label: "Behavioural & Leadership", desc: "Collaboration, ownership, and STAR responses" },
  { key: "company-fit", label: "Company Fit & Values", desc: "Alignment with hiring culture & business domain" },
];

export function KitBuilder({ kitId, kit, onKitUpdate }: KitBuilderProps) {
  const [activeCategory, setActiveCategory] = useState<QuestionCategory>("technical");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [regeneratingCategory, setRegeneratingCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit draft state
  const [editPrompt, setEditPrompt] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<1 | 2 | 3>(2);
  const [editCategory, setEditCategory] = useState<QuestionCategory>("technical");

  const startEdit = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditPrompt(q.prompt);
    setEditAnswer(q.answer_outline);
    setEditDifficulty(q.difficulty);
    setEditCategory(q.category);
  };

  const commitEdit = async (qId: string) => {
    const updatedQuestions = kit.questions.map((q) => {
      if (q.id === qId) {
        return {
          ...q,
          prompt: editPrompt,
          answer_outline: editAnswer,
          difficulty: editDifficulty,
          category: editCategory,
          isEdited: true, // Flagged as edited to guarantee survival upon regeneration
        };
      }
      return q;
    });

    const updatedKit: KitAppendixA = { ...kit, questions: updatedQuestions };
    onKitUpdate(updatedKit);
    setEditingQuestionId(null);
    await persistKit(updatedKit);
  };

  const togglePin = async (qId: string) => {
    const updatedQuestions = kit.questions.map((q) => {
      if (q.id === qId) {
        return { ...q, isPinned: !q.isPinned };
      }
      return q;
    });
    const updatedKit: KitAppendixA = { ...kit, questions: updatedQuestions };
    onKitUpdate(updatedKit);
    await persistKit(updatedKit);
  };

  const deleteQuestion = async (qId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    const updatedQuestions = kit.questions.filter((q) => q.id !== qId);
    // Also remove from schedule
    const updatedDays = kit.schedule.days.map((d) => ({
      ...d,
      question_ids: d.question_ids.filter((id) => id !== qId),
    }));

    const updatedKit: KitAppendixA = {
      ...kit,
      questions: updatedQuestions,
      schedule: { ...kit.schedule, days: updatedDays },
    };
    onKitUpdate(updatedKit);
    await persistKit(updatedKit);
  };

  const moveQuestion = async (index: number, direction: "up" | "down") => {
    const targetCategoryQuestions = kit.questions.filter((q) => q.category === activeCategory);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= targetCategoryQuestions.length) return;

    // Swap in active category
    const itemA = targetCategoryQuestions[index];
    const itemB = targetCategoryQuestions[targetIndex];

    const newQuestions = [...kit.questions];
    const globalIdxA = newQuestions.findIndex((q) => q.id === itemA.id);
    const globalIdxB = newQuestions.findIndex((q) => q.id === itemB.id);

    newQuestions[globalIdxA] = itemB;
    newQuestions[globalIdxB] = itemA;

    const updatedKit = { ...kit, questions: newQuestions };
    onKitUpdate(updatedKit);
    await persistKit(updatedKit);
  };

  const addCustomQuestion = async () => {
    const newId = `q_custom_${Date.now()}`;
    const defaultReqId = kit.role.requirements[0]?.id || "r1";
    const newQuestion: Question = {
      id: newId,
      requirement_ids: [defaultReqId],
      category: activeCategory,
      prompt: "New Custom Question",
      answer_outline: "Expected answer rubric and key points.",
      difficulty: 2,
      origin: "user", // Created by user -> preserved across all regenerations
      isEdited: true,
      isPinned: false,
    };

    const updatedKit = { ...kit, questions: [...kit.questions, newQuestion] };
    onKitUpdate(updatedKit);
    startEdit(newQuestion);
    await persistKit(updatedKit);
  };

  const handleRegenerateCategory = async (category: QuestionCategory) => {
    try {
      setRegeneratingCategory(category);
      const res = await regenerateSection(kitId, "questions", category);
      if (res.success && res.kit) {
        onKitUpdate(res.kit);
      }
    } catch (err: any) {
      alert(`Regeneration failed: ${err.message}`);
    } finally {
      setRegeneratingCategory(null);
    }
  };

  const persistKit = async (updatedKit: KitAppendixA) => {
    setIsSaving(true);
    try {
      await saveKit(kitId, updatedKit);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const currentQuestions = kit.questions.filter((q) => q.category === activeCategory);

  return (
    <div className="space-y-6">
      {/* Category Tabs & Section Regeneration */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const count = kit.questions.filter((q) => q.category === cat.key).length;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => {
                  setActiveCategory(cat.key);
                  setEditingQuestionId(null);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 font-semibold"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-slate-950/20 text-slate-950 font-bold" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={regeneratingCategory !== null}
            onClick={() => handleRegenerateCategory(activeCategory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-teal-800 bg-slate-900 text-xs font-medium text-slate-300 hover:text-teal-400 transition-colors disabled:opacity-50"
            title="Regenerates only untouched AI questions in this category. User-edited and pinned items survive!"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${regeneratingCategory === activeCategory ? "animate-spin text-teal-400" : ""}`}
            />
            <span>Regenerate Category</span>
          </button>

          <button
            type="button"
            onClick={addCustomQuestion}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-xs font-medium text-teal-300 hover:bg-teal-500/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Question</span>
          </button>
        </div>
      </div>

      {/* State preservation explanation hint */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border border-slate-800/60 rounded-xl text-[11px] text-slate-400">
        <Shield className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        <span>
          <strong>State Preservation Guarantee:</strong> Pinned (<Pin className="w-2.5 h-2.5 inline" />), edited, and custom questions are strictly protected and never clobbered when regenerating this category.
        </span>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {currentQuestions.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl">
            <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-400">No questions in this category yet</p>
            <button
              onClick={addCustomQuestion}
              className="mt-3 text-xs text-teal-400 hover:underline inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add one manually
            </button>
          </div>
        ) : (
          currentQuestions.map((q, idx) => {
            const isEditing = editingQuestionId === q.id;

            return (
              <div
                key={q.id}
                className={`bg-slate-900 border rounded-2xl p-5 transition-all ${
                  q.isPinned
                    ? "border-teal-500/40 shadow-lg shadow-teal-500/5 bg-slate-900/90"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                {isEditing ? (
                  /* INLINE EDIT MODE */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                        Editing Question ({q.id})
                      </span>
                      <div className="flex items-center gap-3">
                        <select
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as QuestionCategory)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>
                              Move to: {c.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editDifficulty}
                          onChange={(e) => setEditDifficulty(Number(e.target.value) as 1 | 2 | 3)}
                          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                        >
                          <option value={1}>Diff 1 (Fundamental)</option>
                          <option value={2}>Diff 2 (Intermediate)</option>
                          <option value={3}>Diff 3 (Senior/Complex)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-1">
                        Interview Prompt
                      </label>
                      <textarea
                        rows={2}
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-1">
                        Answer Rubric & Key Discussion Points
                      </label>
                      <textarea
                        rows={3}
                        value={editAnswer}
                        onChange={(e) => setEditAnswer(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingQuestionId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => commitEdit(q.id)}
                        className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  /* VIEW MODE */
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {q.id}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            q.difficulty === 3
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : q.difficulty === 2
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          }`}
                        >
                          Difficulty {q.difficulty}
                        </span>

                        {q.isPinned && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30 flex items-center gap-1">
                            <Pin className="w-2.5 h-2.5" /> Pinned
                          </span>
                        )}

                        {q.isEdited && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/30">
                            Edited
                          </span>
                        )}

                        {q.origin === "user" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                            Custom Added
                          </span>
                        )}

                        {/* Linked requirement tags */}
                        {q.requirement_ids?.map((rId) => (
                          <span
                            key={rId}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono"
                          >
                            covers: {rId}
                          </span>
                        ))}
                      </div>

                      {/* Tooling buttons */}
                      <div className="flex items-center gap-1 shrink-0 text-slate-400">
                        <button
                          type="button"
                          onClick={() => moveQuestion(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveQuestion(idx, "down")}
                          disabled={idx === currentQuestions.length - 1}
                          className="p-1 hover:text-slate-100 disabled:opacity-30 disabled:hover:text-slate-400"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePin(q.id)}
                          className={`p-1 transition-colors ${
                            q.isPinned ? "text-teal-400" : "hover:text-teal-400"
                          }`}
                          title={q.isPinned ? "Unpin question" : "Pin question (locks against regeneration)"}
                        >
                          <Pin className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(q)}
                          className="p-1 hover:text-slate-100"
                          title="Edit question inline"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteQuestion(q.id)}
                          className="p-1 hover:text-red-400"
                          title="Delete question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-100 mb-2 leading-relaxed">
                      {q.prompt}
                    </h4>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-normal">
                      <span className="font-semibold text-slate-400 block mb-1 text-[11px] uppercase tracking-wider">
                        Answer & Criteria Rubric
                      </span>
                      {q.answer_outline}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
