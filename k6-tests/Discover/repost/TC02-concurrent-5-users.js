import { getUrlByVU, requireUrls, runRepost, setupCheck, thresholds } from "../lib/core-repost.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC02-concurrent-5-users";

const USERS = 5;

export const options = {
  scenarios: {
    repost: {
      executor:    "per-vu-iterations",
      vus:         USERS,
      iterations:  1,
      maxDuration: "60m",
    },
  },
  thresholds: {
    ...thresholds,
    repost_e2e_duration: ["p(95)<1800000"],
  },
};

export function setup() {
  setupCheck();
  requireUrls(USERS);
}

// 5 users start at the same time, each reposting its own profile
// (REPOST_URLS entry n for VU n, REPOST_LIMIT videos each). The build machine
// runs jobs one at a time, so most of the time shows up in repost_queue_wait.
export default function () {
  runRepost(getUrlByVU(), { timeoutS: 3000 });
}

export const handleSummary = makeSummary(TC, "repost");
