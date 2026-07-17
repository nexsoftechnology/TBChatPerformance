import { getEntryByVU, runUpload, thresholds } from "../lib/core-image.js";
import { makeSummary } from "../lib/report.js";

const TC = "TC05-concurrent-700-users";

export const options = {
  stages: [
    { duration: "3s",  target: 700 },
    { duration: "20s", target: 700 },
    { duration: "5s",  target: 0   },
  ],
  thresholds,
};

export default function () {
  runUpload(getEntryByVU());
}

export const handleSummary = makeSummary(TC, "upload-image");
