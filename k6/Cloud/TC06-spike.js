import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { getEntry, runUpload, thresholds } from "./lib/core.js";

const TC = "TC06-spike";

export const options = {
  stages: [
    { duration: "10s", target: 0    },
    { duration: "5s",  target: 1000 },
    { duration: "30s", target: 1000 },
    { duration: "5s",  target: 0    },
  ],
  thresholds,
};

export default function () {
  runUpload(getEntry());
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return { [`reports/${TC}_${timestamp}.html`]: htmlReport(data) };
}
