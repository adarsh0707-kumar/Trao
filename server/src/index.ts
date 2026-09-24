import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { authRouter } from "./routes/auth.routes.js";
import { kitsRouter } from "./routes/kits.routes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "trao-ai-interview-prep-server",
    timestamp: new Date().toISOString(),
    dbState: mongoose.connection.readyState === 1 ? "connected" : "in-memory-fallback",
  });
});

// Mount Routes
app.use("/api/auth", authRouter);
app.use("/api/kits", kitsRouter);

// Database Connection
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/trao_interview_prep";

mongoose
  .connect(mongoUri, { serverSelectionTimeoutMS: 2000 })
  .then(() => {
    console.log("[Database] Connected to MongoDB successfully.");
  })
  .catch((err) => {
    console.warn(`[Database] MongoDB offline (${err.message}). Using resilient in-memory storage.`);
  });

// Start Server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`[Server] Trao Prep Kit API running on http://localhost:${PORT}`);
  });
}

export default app;
