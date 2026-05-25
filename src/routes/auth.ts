import { Router } from "express";
import { z } from "zod";

import { usersRepo } from "../db/users";
import { signToken } from "../services/auth";
import { toUserProfile } from "../services/userMapper";

const router = Router();

const loginSchema = z.object({
  username: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", (req, res) => {
  const { username, password } = loginSchema.parse(req.body);

  let user = usersRepo.findByEmail(username);
  if (!user) {
    user = usersRepo.create(username, password);
  } else if (!usersRepo.verifyPassword(user, password)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const access_token = signToken({ sub: user.id, email: user.email });
  res.json({ data: { access_token, user: toUserProfile(user) } });
});

export default router;
