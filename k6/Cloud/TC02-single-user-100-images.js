import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { files, runUpload, thresholds } from "./lib/core.js";

const TC = "TC02-single-user-100-images";

export const options = {
  vus:        1,
  iterations: 100,
  thresholds,
};

export default function () {
  const entry = files[(__ITER) % files.length];
  runUpload(entry);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return { [`reports/${TC}_${timestamp}.html`]: htmlReport(data) };
}
