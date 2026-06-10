import { Worker } from "bullmq";
import path from "path";

import { redisConfig } from "../config/redis";

import {
  processImage
} from "../services/imageProcessor";

import {
  updateJob
} from "../services/jobService";

new Worker(
  "image-processing",

  async (job) => {

    console.log("JOB RECEIVED");
    const {
      jobId,
      filename
    } = job.data;

    updateJob(
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

    await processImage(
      inputFile,
      outputFile
    );

    updateJob(
      jobId,
      {
        status: "completed",
        processedFile:
          `${jobId}.webp`
      }
    );
  },

  {
    connection: redisConfig
  }
);

console.log(
  "Worker started"
);