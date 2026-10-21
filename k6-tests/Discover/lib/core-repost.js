import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import {
  BASE_URL,
  API_KEY,
  REPOST_ENV,
  REPOST_URLS,
  REPOST_LIMIT,
  JOB_TIMEOUT_S,
  POLL_INTERVAL_S,
} from "../config/enviroment.js";

const REQ_TIMEOUT = "30s";
const DONE_STATES = ["succeeded", "failed", "cancelled"];

export const createDuration  = new Trend("repost_create_duration", true);
export const queueWait       = new Trend("repost_queue_wait",      true);
export const runDuration     = new Trend("repost_run_duration",    true);
export const e2eDuration     = new Trend("repost_e2e_duration",    true);
export const jobSuccessRate  = new Rate("repost_job_success");
export const jobsSucceeded   = new Counter("repost_jobs_succeeded");
export const jobsFailed      = new Counter("repost_jobs_failed");
export const jobsTimedOut    = new Counter("repost_jobs_timed_out");

export const thresholds = {
  http_req_failed:          ["rate<0.05"],
  checks:                   ["rate>0.95"],
  repost_create_duration:   ["p(95)<2000"],
  repost_job_success:       ["rate>0.95"],
  repost_e2e_duration:      ["p(95)<300000"],
};

export function setupCheck() {
  if (!API_KEY) {
    throw new Error("API_KEY is empty. Run with: k6 run -e API_KEY=<secret> <file>");
  }
  const res = http.get(`${BASE_URL}/health`, { timeout: REQ_TIMEOUT });
  if (res.status !== 200) {
    throw new Error(`Discover API not healthy: GET /health -> ${res.status}`);
  }
}

export function getUrlByVU() {
  const idx = __VU > 0 ? (__VU - 1) % REPOST_URLS.length : 0;
  return REPOST_URLS[idx];
}

// Server timestamps are naive ISO strings with microseconds; both ends of a
// diff come from the same clock, so only the difference is used.
function _ms(ts) {
  return ts ? Date.parse(String(ts).slice(0, 23)) : NaN;
}

function _getJob(id) {
  return http.get(`${BASE_URL}/jobs/${id}`, { timeout: REQ_TIMEOUT });
}

// opts.limit / opts.timeoutS override the REPOST_LIMIT / JOB_TIMEOUT_S defaults
export function runRepost(url, opts = {}) {
  const limit    = opts.limit    || REPOST_LIMIT;
  const timeoutS = opts.timeoutS || JOB_TIMEOUT_S;
  const body = JSON.stringify({
    url,
    environment: REPOST_ENV,
    limit,
  });

  const createStart = Date.now();
  const createRes = http.post(`${BASE_URL}/reposts`, body, {
    headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
    timeout: REQ_TIMEOUT,
  });
  createDuration.add(Date.now() - createStart);

  const createOk = check(createRes, {
    "create status 202": (r) => r.status === 202,
    "create returns job id": (r) => { try { return !!r.json("id"); } catch { return false; } },
  });

  if (!createOk) {
    jobSuccessRate.add(false);
    console.error(`VU ${__VU} | create failed | status=${createRes.status} body=${createRes.body?.substring(0, 200)}`);
    return;
  }

  const jobId = createRes.json("id");
  const pollStart = Date.now();
  let job = null;

  while ((Date.now() - pollStart) / 1000 < timeoutS) {
    sleep(POLL_INTERVAL_S);
    const res = _getJob(jobId);
    if (res.status !== 200) continue;
    try { job = res.json(); } catch { continue; }
    if (DONE_STATES.indexOf(job.state) !== -1) break;
    job = null;
  }

  if (!job) {
    jobsTimedOut.add(1);
    jobSuccessRate.add(false);
    console.error(`VU ${__VU} | job=${jobId} | timed out after ${timeoutS}s`);
    return;
  }

  e2eDuration.add(Date.now() - createStart);

  const queued   = _ms(job.started_at)  - _ms(job.created_at);
  const running  = _ms(job.finished_at) - _ms(job.started_at);
  if (!isNaN(queued))  queueWait.add(queued);
  if (!isNaN(running)) runDuration.add(running);

  const ok = job.state === "succeeded";
  jobSuccessRate.add(ok);
  if (ok) {
    jobsSucceeded.add(1);
  } else {
    jobsFailed.add(1);
    console.error(`VU ${__VU} | job=${jobId} | state=${job.state} exit_code=${job.exit_code}`);
  }
}
