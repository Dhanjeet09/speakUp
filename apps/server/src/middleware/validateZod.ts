import { Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import sanitizeHtml from "sanitize-html";
import type { AuthenticatedRequest } from "../types";

export function validateZod(schema: ZodSchema, sanitizeFields: string[] = []) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const messages = result.error.issues.map(
        (issue) => `${String(issue.path.join("."))}: ${issue.message}`
      );
      res.status(400).json({ success: false, error: messages.join("; ") });
      return;
    }

    const data = result.data as Record<string, unknown>;

    if (sanitizeFields.length > 0) {
      for (const field of sanitizeFields) {
        const value = data[field];
        if (typeof value === "string") {
          data[field] = sanitizeHtml(value, {
            allowedTags: [],
            allowedAttributes: {},
          });
        }
      }
    }

    req.body = data;
    next();
  };
}
