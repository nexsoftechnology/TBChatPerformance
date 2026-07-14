import { getEntryByVU, runUpload, thresholds } from "../lib/core-video.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC03-concurrent-500-users";

export const options = {
  vus:        500,
  iterations: 500,
  thresholds,
};

export default function () {
  runUpload(getEntryByVU());
}

export const handleSummary = makeSummary(TC, "upload-video");
