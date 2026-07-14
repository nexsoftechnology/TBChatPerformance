import { getEntryByVU, runUpload, thresholds } from "../lib/core-image.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC07-spike";

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
  runUpload(getEntryByVU());
}

export const handleSummary = makeSummary(TC, "upload-image");
