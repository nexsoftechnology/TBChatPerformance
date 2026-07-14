import { getEntryByVU, runUpload, thresholds } from "../lib/core-video.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC02-concurrent-100-users";

export const options = {
  vus:        100,
  iterations: 100,
  thresholds,
};

export default function () {
  runUpload(getEntryByVU());
}

export const handleSummary = makeSummary(TC, "upload-video");
