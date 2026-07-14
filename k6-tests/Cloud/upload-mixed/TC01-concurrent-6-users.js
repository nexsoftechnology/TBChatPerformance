import { getEntryByVU, runUpload, thresholds } from "../lib/core-mixed.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC01-concurrent-6-users";

export const options = {
  vus:        6,
  iterations: 6,
  thresholds,
};

export default function () {
  runUpload(getEntryByVU());
}

export const handleSummary = makeSummary(TC, "upload-mixed");
