import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { requireApiKey } from "../middleware/apiKey";
import { devicesRepo } from "../db/devices";
import { notificationsRepo } from "../db/notifications";
import { sendPush } from "../services/firebase";

const router = Router();

const sendSchema = z.object({
  user_id: z.string().optional(),
  to_self: z.boolean().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string()).optional(),
});

router.post("/send", requireAuth, async (req, res) => {
  const payload = sendSchema.parse(req.body);

  const targetUserId = payload.to_self
    ? req.user!.id
    : payload.user_id ?? req.user!.id;

  const devices = devicesRepo.findByUserId(targetUserId);
  const tokens = devices.map((d) => d.token);

  if (tokens.length === 0) {
    return res
      .status(404)
      .json({ message: "No registered devices for this user" });
  }

  const result = await sendPush({
    tokens,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  });

  result.invalidTokens.forEach((t) => devicesRepo.removeByToken(t));

  notificationsRepo.create({
    userId: targetUserId,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? null,
  });

  res.json({ data: result });
});

const broadcastSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.string()).optional(),
});

router.post("/broadcast", requireApiKey, async (req, res) => {
  const payload = broadcastSchema.parse(req.body);
  const all = devicesRepo.findAllTokens();
  const tokens = all.map((d) => d.token);

  if (tokens.length === 0) {
    return res.status(404).json({ message: "No registered devices" });
  }

  const result = await sendPush({
    tokens,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  });

  result.invalidTokens.forEach((t) => devicesRepo.removeByToken(t));

  notificationsRepo.create({
    userId: null,
    title: payload.title,
    body: payload.body,
    data: payload.data ?? null,
  });

  res.json({ data: result });
});

router.get("/", requireAuth, (req, res) => {
  const list = notificationsRepo.listByUserId(req.user!.id);
  res.json({ data: list });
});

export default router;
