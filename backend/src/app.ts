import "dotenv/config";
import express from "express";
import cors from "cors";

import imageRoutes from "./routes/imageRoutes";

const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
}));

app.use(express.json());

app.get("/health", (_, res) => {
  res.json({
    status: "ok"
  });
});

app.use("/api/images", imageRoutes);

export default app;