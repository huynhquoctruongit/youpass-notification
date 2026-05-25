import { db } from "./index";

export interface NotificationRow {
  id: number;
  user_id: string | null;
  title: string;
  body: string;
  data: string | null;
  created_at: number;
}

export const notificationsRepo = {
  create: (params: {
    userId?: string | null;
    title: string;
    body: string;
    data?: Record<string, string> | null;
  }): NotificationRow => {
    const now = Date.now();
    const result = db
      .prepare(
        `INSERT INTO notifications (user_id, title, body, data, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        params.userId ?? null,
        params.title,
        params.body,
        params.data ? JSON.stringify(params.data) : null,
        now,
      );
    return db
      .prepare("SELECT * FROM notifications WHERE id = ?")
      .get(result.lastInsertRowid) as NotificationRow;
  },

  listByUserId: (userId: string, limit = 50): NotificationRow[] =>
    db
      .prepare(
        "SELECT * FROM notifications WHERE user_id = ? OR user_id IS NULL ORDER BY created_at DESC LIMIT ?",
      )
      .all(userId, limit) as NotificationRow[],
};
