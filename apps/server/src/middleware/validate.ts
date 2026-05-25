import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types";

type ValidationRule = {
  field: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  min?: number;
  max?: number;
  enum?: string[];
  sanitize?: boolean;
};

export function validateBody(rules: ValidationRule[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      if (rule.required && (value === undefined || value === null || value === "")) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rule.type === "number") {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push(`${rule.field} must be a number`);
          continue;
        }
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`${rule.field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`${rule.field} must be at most ${rule.max}`);
        }
      }

      if (rule.type === "string") {
        if (typeof value !== "string") {
          errors.push(`${rule.field} must be a string`);
          continue;
        }
        const str = value.trim();
        if (rule.min !== undefined && str.length < rule.min) {
          errors.push(`${rule.field} must be at least ${rule.min} characters`);
        }
        if (rule.max !== undefined && str.length > rule.max) {
          errors.push(`${rule.field} must be at most ${rule.max} characters`);
        }
        if (rule.enum && !rule.enum.includes(str)) {
          errors.push(
            `${rule.field} must be one of: ${rule.enum.join(", ")}`
          );
        }
      }

      if (rule.type === "boolean" && typeof value !== "boolean") {
        errors.push(`${rule.field} must be a boolean`);
      }
    }

    if (errors.length > 0) {
      res.status(400).json({ success: false, error: errors.join("; ") });
      return;
    }

    next();
  };
}

const SAFE_REGEX = /[<>"'&]/g;

export function sanitizeInput(value: string): string {
  return value.replace(SAFE_REGEX, "");
}
