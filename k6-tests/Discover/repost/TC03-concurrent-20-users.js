import { getUrlByVU, runRepost, setupCheck, thresholds } from "../lib/core-repost.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC03-concurrent-20-users";

export const options = {
  scenarios: {
    repost: {
      executor:    "per-vu-iterations",
      vus:         20,
      iterations:  1,
      maxDuration: "30m",
    },
  },
  thresholds,
};

export function setup() {
  setupCheck();
}

export default function () {
  runRepost(getUrlByVU());
}

export const handleSummary = makeSummary(TC, "repost");
