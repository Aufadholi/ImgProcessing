import { Worker } from "bullmq";
import path from "path";
import fs from "fs";

import { redisConfig } from "../config/redis";

import {
  processImage
} from "../services/imageProcessor";

import {
  updateJob
} from "../services/jobService";

const worker = new Worker(
  "image-processing",

  async (job) => {

    console.log("JOB RECEIVED");
    const {
      jobId,
      filename
    } = job.data;

    await updateJob(
      jobId,
      {
        status: "processing"
      }
    );

    const inputFile =
      path.join(
        process.cwd(),
        "uploads",
        filename
      );

    const outputFile =
      path.join(
        process.cwd(),
        "processed",
        `${jobId}.webp`
      );

    try {
      await processImage(
        inputFile,
        outputFile
      );

      const { size: processedSize } = fs.statSync(outputFile);

      await updateJob(
        jobId,
        {
          status: "completed",
          processedFile: `${jobId}.webp`,
          processedSize
        }
      );
    } catch (err) {
      await updateJob(jobId, {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      });
      throw err; // re-throw agar BullMQ juga mencatat job sebagai failed
    }
  },

  {
    connection: redisConfig
  }
);

worker.on("failed", (job, err) => {
  console.error(`[Worker] BullMQ job ${job?.id} failed:`, err.message);
});

console.log(
  "Worker started"
);