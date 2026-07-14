import { getEntryByVU, runUpload, thresholds } from "../lib/core-video.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC01-video-baseline";

export const options = {
  vus:        1,
  iterations: 1,
  thresholds,
};

export default function () {
  runUpload(getEntryByVU());
}

export const handleSummary = makeSummary(TC);
