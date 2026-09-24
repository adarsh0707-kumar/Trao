"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Globe, Calendar, Upload, FileText, ArrowRight } from "lucide-react";
import { subscribeKitGeneration } from "@/lib/api";
import { LiveGenerationModal } from "./LiveGenerationModal";

export function KitIntakeForm() {
  const router = useRouter();

  const [jd, setJd] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchFile, setBatchFile] = useState<File | null>(null);

  // Modal & Generation Stream State
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState("INIT");
  const [progressMsg, setProgressMsg] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [gapDetails, setGapDetails] = useState<string[] | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedKitId, setGeneratedKitId] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim() || !companyUrl.trim()) return;

    setIsGenerating(true);
    setProgressPercent(5);
    setProgressMsg("Connecting to research pipeline...");
    setErrorMsg(null);
    setGapDetails(undefined);
    setGeneratedKitId(null);

    subscribeKitGeneration(
      jd,
      companyUrl,
      days,
      (evt) => {
        setCurrentStep(evt.step);
        setProgressMsg(evt.message);
        setProgressPercent(evt.progressPercent);
        if (evt.data?.gaps) {
          setGapDetails(evt.data.gaps);
        }
      },
      (kitId) => {
        setProgressPercent(100);
        setProgressMsg("Kit ready!");
        setGeneratedKitId(kitId);
      },
      (err) => {
        setErrorMsg(err.message || "Failed to generate interview prep kit");
      }
    );
  };

  const handleModalClose = () => {
    if (generatedKitId) {
      router.push(`/kits/${generatedKitId}`);
    } else {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBatchFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Pre-populate with first item
          setJd(parsed[0].jd || "");
          setCompanyUrl(parsed[0].company_url || "");
          setDays(parsed[0].days || 5);
        }
      } catch {
        alert("Invalid JSON format in uploaded file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              Create Personalized Prep Kit
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Autonomous research across company pages, culture synthesis, and deterministic day allocation
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsBatchMode(!isBatchMode)}
            className="text-xs text-slate-400 hover:text-teal-400 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-teal-800 transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            {isBatchMode ? "Paste Single Role" : "Upload Multi-Role File"}
          </button>
        </div>

        {isBatchMode ? (
          <div className="mb-6 p-6 border-2 border-dashed border-slate-800 rounded-xl text-center bg-slate-950/40">
            <Upload className="w-8 h-8 text-teal-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-200">Upload description-and-company JSON</p>
            <p className="text-xs text-slate-500 mb-3">Accepts array of {"{ jd, company_url, days }"}</p>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-500/10 file:text-teal-300 hover:file:bg-teal-500/20 cursor-pointer"
            />
            {batchFile && (
              <p className="mt-2 text-xs text-teal-400">Loaded: {batchFile.name}</p>
            )}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Job Description Textarea */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="jd-textarea" className="font-medium text-slate-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                Job Description
              </label>
              <span className="text-slate-500">{jd.length} characters</span>
            </div>
            <textarea
              id="jd-textarea"
              rows={6}
              required
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste raw job description here (responsibilities, required qualifications, bonus points)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors resize-y font-mono"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Company Website Field */}
            <div className="space-y-2">
              <label htmlFor="company-url" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-teal-400" />
                Company Website Address
              </label>
              <input
                id="company-url"
                type="url"
                required
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500 transition-colors"
              />
              <p className="text-[11px] text-slate-500">
                Discovers /careers, /jobs, culture values, and public interview insights
              </p>
            </div>

            {/* Days Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label htmlFor="days-range" className="font-medium text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  Days Before Interview
                </label>
                <span className="font-bold text-teal-400 bg-teal-950/60 border border-teal-800/40 px-2 py-0.5 rounded text-xs">
                  {days} {days === 1 ? "day" : "days"}
                </span>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <input
                  id="days-range"
                  type="range"
                  min="1"
                  max="60"
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
                />
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value))))}
                  className="w-16 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-sm text-center text-slate-100 focus:outline-none focus:border-teal-500"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Determines deterministic arithmetic distribution of daily topics & durations
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={!jd.trim() || !companyUrl.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold text-sm transition-all shadow-lg shadow-teal-500/20 active:scale-[0.99]"
          >
            <span>Generate Interview Prep Kit</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>

      <LiveGenerationModal
        isOpen={isGenerating}
        currentStep={currentStep}
        message={progressMsg}
        progressPercent={progressPercent}
        gapDetails={gapDetails}
        error={errorMsg}
        onClose={handleModalClose}
      />
    </>
  );
}
