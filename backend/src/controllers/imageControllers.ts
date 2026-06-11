import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";

import {
  createJob,
  getJob
} from "../services/jobService";
import { imageQueue } from "../queues/imageQueue";

export const uploadImage = async (
  req: Request,
  res: Response
) => {
  if (!req.file) {
    return res.status(400).json({
      message: "No image uploaded"
    });
  }

  const jobId = uuidv4();

  await createJob({
    jobId,
    originalFile: req.file.filename,
    status: "pending"
  });

  await imageQueue.add(
    "resize-image",
    {
      jobId,
      filename:
        req.file.filename
    }

  );

  const queueCount = await imageQueue.count();

  console.log(
    "QUEUE COUNT:",
    queueCount
  );

  return res.status(201).json({
    jobId,
    status: "pending"
  });
};

export const getJobStatus = async (
  req: Request,
  res: Response
) => {
  const id = req.params.id;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({
      message: "Invalid job id"
    });
  }

  const job = await getJob(id);

  if (!job) {
    return res.status(404).json({
      message: "Job not found"
    });
  }

  return res.json(job);
};

export const downloadImage = async (
  req: Request,
  res: Response
) => {
  const id = req.params.id;

  if (!id || Array.isArray(id)) {
    return res.status(400).json({
      message: "Invalid job id"
    });
  }

  const job = await getJob(id);

  if (!job) {
    return res.status(404).json({
      message: "Job not found"
    });
  }

  if (job.status !== "completed" || !job.processedFile) {
    return res.status(400).json({ message: "File not ready yet" });
  }

  const filePath = path.join(
    process.cwd(),
    "processed",
    job.processedFile
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      message: "Processed file missing"
    });
  }

  return res.download(filePath);
};