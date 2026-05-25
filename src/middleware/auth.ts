import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../services/auth";
import { usersRepo, UserRow } from "../db/users";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserRow;
    }
  }
}

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing bearer token" });
  }
  const token = header.slice("Bearer ".length).trim();
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: "Invalid token" });
  }
  const user = usersRepo.findById(payload.sub);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  req.user = user;
  next();
};
