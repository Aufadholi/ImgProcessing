import { Job } from "../types/job";
import Redis from "ioredis";
import { redisConfig } from "../config/redis";

const redis = new Redis(redisConfig);
const JOB_TTL = 60 * 60 * 24; // 24 hours

export const createJob = async (job: Job): Promise<void> => {
  await redis.set(`job:${job.jobId}`, JSON.stringify(job), "EX", JOB_TTL);
};

export const getJob = async (jobId: string): Promise<Job | null> => {
  const raw = await redis.get(`job:${jobId}`);
  if (!raw) return null;
  return JSON.parse(raw) as Job;
};

export const updateJob = async (jobId: string, updates: Partial<Job>): Promise<void> => {
  const raw = await redis.get(`job:${jobId}`);
  if (!raw) return;
  const updated = { ...JSON.parse(raw) as Job, ...updates };
  await redis.set(`job:${jobId}`, JSON.stringify(updated), "EX", JOB_TTL);
};