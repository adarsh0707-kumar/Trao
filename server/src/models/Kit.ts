import mongoose, { Schema, Document } from "mongoose";
import type { KitAppendixA } from "@trao/shared";

export interface IKitDocument extends Document {
  userId?: mongoose.Types.ObjectId;
  status: "generating" | "ready" | "failed";
  data: KitAppendixA;
  error?: {
    code: string;
    message: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const RequirementSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    kind: { type: String, enum: ["technical", "behavioural", "domain"], required: true },
    priority: { type: String, enum: ["must", "nice"], required: true },
  },
  { _id: false }
);

const QuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    requirement_ids: [{ type: String }],
    category: {
      type: String,
      enum: ["technical", "behavioural", "system-design", "company-fit"],
      required: true,
    },
    prompt: { type: String, required: true },
    answer_outline: { type: String, required: true },
    difficulty: { type: Number, enum: [1, 2, 3], required: true },
    isEdited: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    origin: { type: String, enum: ["generated", "user"], default: "generated" },
  },
  { _id: false }
);

const FlashcardSchema = new Schema(
  {
    id: { type: String, required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    requirement_ids: [{ type: String }],
    confidence: { type: Number, enum: [1, 2, 3, 4, 5], default: 3 },
    lastPracticedAt: { type: String },
    isEdited: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    origin: { type: String, enum: ["generated", "user"], default: "generated" },
  },
  { _id: false }
);

const DayScheduleSchema = new Schema(
  {
    day: { type: Number, required: true },
    focus: { type: String, required: true },
    question_ids: [{ type: String }],
    minutes: { type: Number, required: true },
  },
  { _id: false }
);

const KitSchema = new Schema<IKitDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    status: {
      type: String,
      enum: ["generating", "ready", "failed"],
      default: "generating",
    },
    data: {
      source: {
        company: String,
        company_url: String,
        role: String,
        location: String,
        jd_chars: Number,
        researched_at: String,
        pages_used: [String],
      },
      company_brief: {
        summary: String,
        what_they_do: String,
        sources: [String],
      },
      role: {
        title: String,
        seniority: String,
        responsibilities: [String],
        requirements: [RequirementSchema],
      },
      questions: [QuestionSchema],
      flashcards: [FlashcardSchema],
      schedule: {
        days_available: Number,
        days: [DayScheduleSchema],
      },
      coverage: {
        uncovered_requirement_ids: [String],
        passes: Number,
      },
    },
    error: {
      code: String,
      message: String,
    },
  },
  { timestamps: true }
);

export const KitModel = mongoose.models.Kit || mongoose.model<IKitDocument>("Kit", KitSchema);
