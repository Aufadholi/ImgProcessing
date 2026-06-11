import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    timeout: 60_000,        // 60s per test — worker needs time to process
    retries: 0,
    use: {
        baseURL: "http://localhost:5173",  // host port mapped from Nginx (5173:80 in docker-compose)
        headless: true,               // set false to watch the browser
    },
    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});