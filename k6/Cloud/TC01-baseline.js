import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { getEntry, runUpload, thresholds } from "./lib/core.js";

const TC = "TC01-baseline";

export const options = {
  vus:        1,
  iterations: 1,
  thresholds,
};

export default function () {
  runUpload(getEntry());
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return { [`reports/${TC}_${timestamp}.html`]: htmlReport(data) };
}
