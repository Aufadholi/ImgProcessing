import { useState, useEffect, useRef, useCallback } from "react";
import { getJobStatus } from "../api";
import type { JobResponse } from "../api";

const MIN_INTERVAL = 1000;  // mulai dari 1 detik
const MAX_INTERVAL = 16000; // maksimal 16 detik
const MULTIPLIER = 2;       // dobel tiap kali polling

export const useJobPolling = (jobId: string | null) => {
    const [job, setJob] = useState<JobResponse | null>(null);
    const [pollingError, setPollingError] = useState<string | null>(null);

    const intervalRef = useRef<number>(MIN_INTERVAL);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeRef = useRef(false);

    const stop = useCallback(() => {
        activeRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    const poll = useCallback(async (id: string) => {
        if (!activeRef.current) return;

        try {
            const result = await getJobStatus(id);
            setJob(result);

            // Berhenti polling kalau sudah final
            if (result.status === "completed" || result.status === "failed") {
                stop();
                return;
            }
        } catch (err) {
            setPollingError(err instanceof Error ? err.message : "Polling error");
            stop();
            return;
        }

        // Exponential backoff: dobel interval, maksimal MAX_INTERVAL
        intervalRef.current = Math.min(intervalRef.current * MULTIPLIER, MAX_INTERVAL);
        timerRef.current = setTimeout(() => poll(id), intervalRef.current);
    }, [stop]);

    useEffect(() => {
        if (!jobId) return;

        // Reset semua state saat jobId baru masuk
        setJob(null);
        setPollingError(null);
        intervalRef.current = MIN_INTERVAL;
        activeRef.current = true;

        poll(jobId);

        return () => stop();
    }, [jobId, poll, stop]);

    return { job, pollingError };
};