import crypto from "node:crypto";
import { db } from "./index";

export interface UserRow {
  id: string;
  email: string;
  password: string;
  fullname: string | null;
  created_at: number;
}

const hashPassword = (password: string) =>
  crypto.createHash("sha256").update(password).digest("hex");

export const usersRepo = {
  findByEmail: (email: string): UserRow | undefined =>
    db
      .prepare("SELECT * FROM users WHERE email = ?")
      .get(email.toLowerCase()) as UserRow | undefined,

  findById: (id: string): UserRow | undefined =>
    db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined,

  create: (email: string, password: string, fullname?: string): UserRow => {
    const id = crypto.randomUUID();
    const now = Date.now();
    db.prepare(
      `INSERT INTO users (id, email, password, fullname, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, email.toLowerCase(), hashPassword(password), fullname ?? null, now);
    return usersRepo.findById(id)!;
  },

  verifyPassword: (user: UserRow, password: string): boolean =>
    user.password === hashPassword(password),

  upsertById: (id: string): void => {
    const now = Date.now();
    db.prepare(
      `INSERT OR IGNORE INTO users (id, email, password, fullname, created_at)
       VALUES (?, ?, '', NULL, ?)`,
    ).run(id, `${id}@device.local`, now);
  },
};
