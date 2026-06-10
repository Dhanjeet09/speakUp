import { Router, Response } from "express";
import { prisma } from "../lib/db";
import { requireAuth } from "../middleware/auth";
import { validateZod } from "../middleware/validateZod";
import { AppError, asyncHandler } from "../middleware/errorHandler";
import { createAnonSupabaseClient, createSupabaseClient } from "../lib/supabase";
import { registerSchema, loginSchema, forgotPasswordSchema } from "../schemas";
import { logInfo, logWarn } from "../lib/logger";
import type { AuthenticatedRequest } from "../types";

const router = Router();

const verifyHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  let profile = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      country: true,
      timezone: true,
      nativeLanguage: true,
      bio: true,
      avatarUrl: true,
      englishLevel: true,
      interests: true,
      totalMinutes: true,
      totalSessions: true,
      currentStreak: true,
      role: true,
      createdAt: true,
      isSuspended: true,
    },
  });

  if (!profile) {
    profile = await prisma.user.create({
      data: {
        id: req.userId!,
        email: req.userEmail || "",
        name: req.userEmail?.split("@")[0] || "User",
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        country: true,
        timezone: true,
        nativeLanguage: true,
        bio: true,
        avatarUrl: true,
        englishLevel: true,
        interests: true,
        totalMinutes: true,
        totalSessions: true,
        currentStreak: true,
        role: true,
        createdAt: true,
        isSuspended: true,
      },
    });
  }

  res.json({
    success: true,
    data: {
      user: { id: req.userId, email: req.userEmail },
      profile,
    },
  });
});

router.post(
  "/forgot-password",
  validateZod(forgotPasswordSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { email } = req.body;
    const supabase = createAnonSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      logWarn("Auth", "Forgot password error", { error: error.message });
    }
    res.json({ success: true, data: { message: "If the email exists, a reset link has been sent" } });
  })
);

router.post(
  "/register",
  validateZod(registerSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const supabase = createAnonSupabaseClient();
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      logWarn("Auth", "Registration failed", { error: error.message });
      throw new AppError("Registration failed. Please try again.", 400);
    }
    logInfo("Auth", "User registered", { userId: data.user?.id });
    res.status(201).json({ success: true, data: { user: data.user } });
  })
);

router.post(
  "/login",
  validateZod(loginSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { email, password } = req.body;
    const supabase = createAnonSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new AppError(error.message, 401);
    }
    res.json({ success: true, data: { session: data.session, user: data.user } });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      try {
        const supabase = createSupabaseClient();
        await supabase.auth.admin.signOut(token);
      } catch {
        logWarn("Auth", "Server-side token revocation failed (token may already be invalid)");
      }
    }
    res.json({ success: true });
  })
);

router.get("/me", requireAuth, verifyHandler);
router.post("/verify", requireAuth, verifyHandler);

export default router;
