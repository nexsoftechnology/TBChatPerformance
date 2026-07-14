import { getEntryByIteration, runUpload, thresholds } from "../lib/core-image.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC02-single-user-100-images";

export const options = {
  vus:        1,
  iterations: 100,
  thresholds,
};

export default function () {
  runUpload(getEntryByIteration());
}

export const handleSummary = makeSummary(TC, "upload-image");
