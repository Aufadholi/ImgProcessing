const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface JobResponse {
    jobId: string;
    status: JobStatus;
    originalFile: string;
    processedFile?: string;
    errorMessage?: string;
}

export const uploadImage = async (file: File): Promise<JobResponse> => {
    const form = new FormData();
    form.append("image", file);

    const res = await fetch(`${BASE_URL}/api/images/upload`, {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Upload failed");
    }

    return res.json();
};

export const getJobStatus = async (jobId: string): Promise<JobResponse> => {
    const res = await fetch(`${BASE_URL}/api/images/jobs/${jobId}`);

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Failed to fetch status");
    }

    return res.json();
};

export const getDownloadUrl = (jobId: string): string =>
    `${BASE_URL}/api/images/download/${jobId}`;