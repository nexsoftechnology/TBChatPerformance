import { getEntryByVU, runUpload, thresholds } from "../lib/core-image.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC06-concurrent-1000-users";

export const options = {
  vus:        1000,
  iterations: 1000,
  thresholds,
};

export default function () {
  runUpload(getEntryByVU());
}

export const handleSummary = makeSummary(TC, "upload-image");
