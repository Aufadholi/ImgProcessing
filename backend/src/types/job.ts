export type JobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface Job {
  jobId: string;
  originalFile: string;
  processedFile?: string;
  errorMessage?: string;
  status: JobStatus;
}