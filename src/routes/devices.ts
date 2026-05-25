import { Router } from "express";
import { z } from "zod";

import { requireApiKey } from "../middleware/apiKey";
import { asyncHandler } from "../middleware/asyncHandler";
import { devicesRepo } from "../db/devices";
import { usersRepo } from "../db/users";

const router = Router();

const BROADCAST_USER_ID = "broadcast";

const registerSchema = z.object({
  user_id: z.string().min(1).optional(),
  token: z.string().min(10),
  platform: z.enum(["ios", "android", "web"]),
});

router.get("/", requireApiKey, asyncHandler((req, res) => {
  const list = devicesRepo.findAllTokens();
  res.json({ data: list, total: list.length });
}));

router.post("/", requireApiKey, asyncHandler((req, res) => {
  const { user_id, token, platform } = registerSchema.parse(req.body);
  const uid = user_id ?? BROADCAST_USER_ID;
  usersRepo.upsertById(uid);
  const device = devicesRepo.upsert(uid, token, platform);
  res.json({
    data: {
      id: device.id,
      token: device.token,
      platform: device.platform,
    },
  });
}));

router.delete("/:token", requireApiKey, asyncHandler((req, res) => {
  const raw = req.params.token;
  const token = decodeURIComponent(Array.isArray(raw) ? raw[0] : raw);
  const changes = devicesRepo.removeByToken(token);
  res.json({ data: { removed: changes } });
}));

export default router;
