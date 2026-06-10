export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface Job {
  jobId: string;
  originalFile: string;
  processedFile?: string;
  status: JobStatus;
}