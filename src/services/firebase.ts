import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

let app: admin.app.App | null = null;

const loadServiceAccount = (): admin.ServiceAccount | null => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      // strip surrounding quotes if accidentally added when pasting
      const cleaned = raw.trim().replace(/^["']|["']$/g, "");
      const parsed = JSON.parse(cleaned);
      console.log("[firebase] Loaded service account for project:", parsed.project_id);
      return parsed;
    } catch (err) {
      console.error("[firebase] Invalid FIREBASE_SERVICE_ACCOUNT_JSON — parse failed:", err);
      console.error("[firebase] Value preview:", raw.slice(0, 50));
      return null;
    }
  }

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!filePath) return null;

  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) {
    console.warn(`[firebase] Service account file not found at ${abs}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(abs, "utf-8"));
};

export const initFirebase = (): admin.app.App | null => {
  if (app) return app;
  const sa = loadServiceAccount();
  if (!sa) {
    console.warn(
      "[firebase] No service account configured. Push sending will be disabled.",
    );
    return null;
  }
  app = admin.initializeApp({ credential: admin.credential.cert(sa) });
  console.log("[firebase] Initialized");
  return app;
};

export interface SendPushParams {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface SendPushResult {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}

export const sendPush = async ({
  tokens,
  title,
  body,
  data,
}: SendPushParams): Promise<SendPushResult> => {
  if (!app) initFirebase();
  if (!app) {
    throw new Error("Firebase Admin is not configured");
  }
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  const messaging = admin.messaging(app);
  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data,
    android: { priority: "high" },
    apns: {
      headers: { "apns-priority": "10" },
      payload: { aps: { sound: "default" } },
    },
  });

  const invalidTokens: string[] = [];
  response.responses.forEach((res, idx) => {
    if (!res.success) {
      const code = res.error?.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        invalidTokens.push(tokens[idx]);
      }
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens,
  };
};
