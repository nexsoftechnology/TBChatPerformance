import { getUrlByVU, requireUrls, runRepost, setupCheck, thresholds } from "../lib/core-repost.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC03-concurrent-50-users";

const USERS  = parseInt(__ENV.USERS || "50", 10);
const VIDEOS = 1;

export const options = {
  scenarios: {
    repost: {
      executor:    "per-vu-iterations",
      vus:         USERS,
      iterations:  1,
      maxDuration: "110m",
    },
  },
  thresholds: {
    ...thresholds,
    repost_e2e_duration: ["p(95)<5400000"],
  },
};

export function setup() {
  setupCheck();
  requireUrls(USERS);
}

// USERS (default 50) users, one TikTok account each, start together, each reposting 1 new video of
// its own profile (REPOST_URLS entry n for VU n). The build machine runs one
// repost job at a time, so the last user waits for the 49 jobs before it:
// expect long repost_queue_wait and read repost_run_duration for per-job time.
// Every profile needs a video not yet reposted to the environment.
export default function () {
  runRepost(getUrlByVU(), { limit: VIDEOS, timeoutS: 6000 });
}

export const handleSummary = makeSummary(TC, "repost");
