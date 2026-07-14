import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

export function makeSummary(tcName, subfolder) {
  return function (data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return { [`reports/Cloud/${subfolder}/${tcName}_${timestamp}.html`]: htmlReport(data) };
  };
}
