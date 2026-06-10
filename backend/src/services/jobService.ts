import { Job } from "../types/job";

const jobs = new Map<string, Job>();

export const createJob = (job: Job) => {
  jobs.set(job.jobId, job);
};

export const getJob = (jobId: string) => {
  return jobs.get(jobId);
};

export const updateJob = (
  jobId: string,
  updates: Partial<Job>
) => {
  const job = jobs.get(jobId);

  if (!job) return;

  jobs.set(jobId, {
    ...job,
    ...updates
  });
};