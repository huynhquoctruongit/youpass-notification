import { Router } from "express";
import { z } from "zod";

import { requireApiKey } from "../middleware/apiKey";
import { devicesRepo } from "../db/devices";
import { usersRepo } from "../db/users";

const router = Router();

const registerSchema = z.object({
  user_id: z.string().min(1),
  token: z.string().min(10),
  platform: z.enum(["ios", "android", "web"]),
});

router.post("/", requireApiKey, (req, res) => {
  const { user_id, token, platform } = registerSchema.parse(req.body);
  usersRepo.upsertById(user_id);
  const device = devicesRepo.upsert(user_id, token, platform);
  res.json({
    data: {
      id: device.id,
      token: device.token,
      platform: device.platform,
    },
  });
});

router.delete("/:token", requireApiKey, (req, res) => {
  const raw = req.params.token;
  const token = decodeURIComponent(Array.isArray(raw) ? raw[0] : raw);
  const changes = devicesRepo.removeByToken(token);
  res.json({ data: { removed: changes } });
});

export default router;
