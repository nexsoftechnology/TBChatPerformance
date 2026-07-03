import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { getEntry, runUpload, thresholds } from "./lib/core.js";

const TC = "TC05-concurrent-1000-users";

export const options = {
  vus:        1000,
  iterations: 1000,
  thresholds,
};

export default function () {
  runUpload(getEntry());
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return { [`reports/${TC}_${timestamp}.html`]: htmlReport(data) };
}
