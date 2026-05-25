import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { devicesRepo } from "../db/devices";
import { toUserProfile } from "../services/userMapper";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.json({ data: toUserProfile(req.user!) });
});

const registerDeviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(["ios", "android", "web"]),
  device_id: z.string().optional(),
});

router.post("/me/devices", requireAuth, (req, res) => {
  const { token, platform } = registerDeviceSchema.parse(req.body);
  const device = devicesRepo.upsert(req.user!.id, token, platform);
  res.json({
    data: {
      id: device.id,
      token: device.token,
      platform: device.platform,
    },
  });
});

router.delete("/me/devices/:token", requireAuth, (req, res) => {
  const raw = req.params.token;
  const token = decodeURIComponent(Array.isArray(raw) ? raw[0] : raw);
  const changes = devicesRepo.removeByToken(token);
  res.json({ data: { removed: changes } });
});

router.get("/me/devices", requireAuth, (req, res) => {
  const list = devicesRepo.findByUserId(req.user!.id);
  res.json({ data: list });
});

export default router;
