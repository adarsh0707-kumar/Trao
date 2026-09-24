import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserModel } from "../models/User.js";
import { requireAuth, type AuthenticatedRequest } from "../middleware/auth.js";

export const authRouter = Router();

// In-memory user fallback if MongoDB is not active
const inMemoryUsers = new Map<string, { id: string; email: string; passwordHash: string; name: string }>();

authRouter.post("/register", async (req, res): Promise<void> => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required" } });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}`;

    try {
      // Try MongoDB
      const existing = await UserModel.findOne({ email: cleanEmail });
      if (existing) {
        res.status(409).json({ error: { code: "USER_EXISTS", message: "An account with this email already exists" } });
        return;
      }
      const user = await UserModel.create({
        email: cleanEmail,
        passwordHash,
        name: name || "Candidate",
      });

      const secret = process.env.JWT_SECRET || "dev-fallback-secret-key-trao";
      const token = jwt.sign({ id: user._id.toString(), email: user.email }, secret, {
        expiresIn: "7d",
      });

      res.status(201).json({
        user: { id: user._id.toString(), email: user.email, name: user.name },
        token,
      });
      return;
    } catch {
      // In-memory fallback
      if (inMemoryUsers.has(cleanEmail)) {
        res.status(409).json({ error: { code: "USER_EXISTS", message: "An account with this email already exists" } });
        return;
      }

      const userObj = { id: userId, email: cleanEmail, passwordHash, name: name || "Candidate" };
      inMemoryUsers.set(cleanEmail, userObj);

      const secret = process.env.JWT_SECRET || "dev-fallback-secret-key-trao";
      const token = jwt.sign({ id: userId, email: cleanEmail }, secret, { expiresIn: "7d" });

      res.status(201).json({
        user: { id: userId, email: cleanEmail, name: userObj.name },
        token,
      });
      return;
    }
  } catch (err: any) {
    res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

authRouter.post("/login", async (req, res): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password are required" } });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    let user: any = null;

    try {
      user = await UserModel.findOne({ email: cleanEmail });
    } catch {
      user = inMemoryUsers.get(cleanEmail);
    }

    if (!user) {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
      return;
    }

    const userId = user._id ? user._id.toString() : user.id;
    const secret = process.env.JWT_SECRET || "dev-fallback-secret-key-trao";
    const token = jwt.sign({ id: userId, email: user.email }, secret, { expiresIn: "7d" });

    res.json({
      user: { id: userId, email: user.email, name: user.name },
      token,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "SERVER_ERROR", message: err.message } });
  }
});

authRouter.get("/me", requireAuth, async (req: AuthenticatedRequest, res): Promise<void> => {
  res.json({ user: req.user });
});
