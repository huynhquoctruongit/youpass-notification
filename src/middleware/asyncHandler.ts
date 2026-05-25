import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler =>
  (req, res, next) => {
    try {
      const result = fn(req, res, next);
      if (result instanceof Promise) {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
