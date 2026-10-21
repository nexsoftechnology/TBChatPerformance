import { getUrlByVU, runRepost, setupCheck, thresholds } from "../lib/core-repost.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC01-single-user-20-videos";

const VIDEOS = 20;

export const options = {
  scenarios: {
    repost: {
      executor:    "per-vu-iterations",
      vus:         1,
      iterations:  1,
      maxDuration: "40m",
    },
  },
  thresholds: {
    ...thresholds,
    repost_e2e_duration: ["p(95)<1200000"],
  },
};

export function setup() {
  setupCheck();
}

// One job reposting the VIDEOS most recent videos of the profile. Only videos
// not yet posted to the environment are uploaded, so use a profile that has at
// least VIDEOS unposted videos or the job finishes early with nothing posted.
export default function () {
  runRepost(getUrlByVU(), { limit: VIDEOS, timeoutS: 1800 });
}

export const handleSummary = makeSummary(TC, "repost");
