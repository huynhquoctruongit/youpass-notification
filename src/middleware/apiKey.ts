import { NextFunction, Request, Response } from "express";

export const requireApiKey = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const key = req.headers["x-api-key"];
  const expected = process.env.NOTIFY_API_KEY;
  if (!expected) {
    return res.status(503).json({ message: "API key not configured on server" });
  }
  if (!key || key !== expected) {
    return res.status(401).json({ message: "Invalid or missing API key" });
  }
  next();
};
