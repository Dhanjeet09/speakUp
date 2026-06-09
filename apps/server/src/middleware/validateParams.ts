import { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types";

const CUID_REGEX = /^c[a-z0-9]{24,}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidId(id: string): boolean {
  return CUID_REGEX.test(id) || UUID_REGEX.test(id);
}

export function validateParamId(...paramNames: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value && !isValidId(value)) {
        res.status(400).json({ success: false, error: `Invalid ${name} format` });
        return;
      }
    }
    next();
  };
}
