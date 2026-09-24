import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication token missing or invalid",
      },
    });
    return;
  }

  const token = authHeader.split(" ")[1];
  const secret = process.env.JWT_SECRET || "dev-fallback-secret-key-trao";

  try {
    const decoded = jwt.verify(token, secret) as { id: string; email: string };
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: {
        code: "SESSION_EXPIRED",
        message: "Session expired or invalid token. Please log in again.",
      },
    });
  }
}

/**
 * Optional authentication middleware: if token present, sets req.user; otherwise proceeds as anonymous.
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "dev-fallback-secret-key-trao";
    try {
      req.user = jwt.verify(token, secret) as { id: string; email: string };
    } catch {
      // ignore expired token in optional auth
    }
  }
  next();
}
