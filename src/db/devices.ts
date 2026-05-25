import { db } from "./index";

export type DevicePlatform = "ios" | "android" | "web";

export interface DeviceRow {
  id: number;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  created_at: number;
  updated_at: number;
}

export const devicesRepo = {
  upsert: (userId: string, token: string, platform: DevicePlatform): DeviceRow => {
    const now = Date.now();
    db.prepare(
      `INSERT INTO devices (user_id, token, platform, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET
         user_id = excluded.user_id,
         platform = excluded.platform,
         updated_at = excluded.updated_at`,
    ).run(userId, token, platform, now, now);
    return db
      .prepare("SELECT * FROM devices WHERE token = ?")
      .get(token) as DeviceRow;
  },

  removeByToken: (token: string): number =>
    db.prepare("DELETE FROM devices WHERE token = ?").run(token).changes,

  findByUserId: (userId: string): DeviceRow[] =>
    db
      .prepare("SELECT * FROM devices WHERE user_id = ?")
      .all(userId) as DeviceRow[],

  findAllTokens: (): DeviceRow[] =>
    db.prepare("SELECT * FROM devices").all() as DeviceRow[],
};
