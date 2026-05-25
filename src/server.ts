import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";

import "./db";
import { initFirebase } from "./services/firebase";
import { errorHandler } from "./middleware/error";

import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import notificationsRouter from "./routes/notifications";
import devicesRouter from "./routes/devices";

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/v1", authRouter);
app.use("/v1/users", usersRouter);
app.use("/v1/notifications", notificationsRouter);
app.use("/v1/devices", devicesRouter);

app.use(errorHandler);

initFirebase();

app.listen(PORT, () => {
  console.log(`[server] yp-notify-be listening on http://localhost:${PORT}`);
});
