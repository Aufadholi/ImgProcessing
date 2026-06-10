import { Queue } from "bullmq";
import { redisConfig } from "../config/redis";

export const imageQueue = new Queue(
  "image-processing",
  {
    connection: redisConfig
  }
);