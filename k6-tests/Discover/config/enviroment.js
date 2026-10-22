const environments = {
  qa: {
    baseUrl: "http://mac-mini-2.local:8080/api/v1",
  },
};

const envName = __ENV.ENV || "qa";
const current = environments[envName];

if (!current) {
  throw new Error(
    `Unknown ENV "${envName}". Valid options: ${Object.keys(environments).join(", ")}`,
  );
}

// Environment the repost job publishes into (body field "environment").
// "prod" is rejected on purpose: every request creates a real post.
const REPOST_ENV = __ENV.REPOST_ENV || "test";
if (REPOST_ENV !== "dev" && REPOST_ENV !== "test") {
  throw new Error(`REPOST_ENV must be "dev" or "test", got "${REPOST_ENV}"`);
}

// API key is never committed: pass it with -e API_KEY=<secret>
const API_KEY = __ENV.API_KEY || "";

// Profiles/videos to repost, comma separated. VU n takes entry (n-1) % length.
// Use distinct profiles for concurrent VUs: one profile = one account folder
// on the build machine, so two jobs on the same profile can collide.
const REPOST_URLS = (__ENV.REPOST_URLS || "https://www.tiktok.com/@hp281098/")
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean);

// Videos taken per profile (server accepts 1-20).
const REPOST_LIMIT = parseInt(__ENV.REPOST_LIMIT || "1", 10);

// Seconds to wait for a job to finish before counting it as timed out.
const JOB_TIMEOUT_S = parseInt(__ENV.JOB_TIMEOUT_S || "600", 10);
const POLL_INTERVAL_S = parseInt(__ENV.POLL_INTERVAL_S || "3", 10);

// PROMOTE=true: right after creating a job, call POST /jobs/{id}/promote so it
// starts now in the parallel lane instead of waiting behind a running build.
// Server answers 409 while another repost/interaction/gen is running.
const PROMOTE = (__ENV.PROMOTE || "false").toLowerCase() === "true";

export const BASE_URL = current.baseUrl;
export const ENV_NAME = envName;
export {
  API_KEY,
  REPOST_ENV,
  REPOST_URLS,
  REPOST_LIMIT,
  JOB_TIMEOUT_S,
  POLL_INTERVAL_S,
  PROMOTE,
};
