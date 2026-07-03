import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";

const BASE_URL   = __ENV.BASE_URL   || "https://node1.17qpb.com:3065";
const NUM_USERS  = parseInt(__ENV.NUM_USERS  || "1000", 10);
const NUM_IMAGES = parseInt(__ENV.NUM_IMAGES || "1",    10);

export const options = {
  vus:        NUM_USERS,
  iterations: NUM_USERS * NUM_IMAGES,
  thresholds: {
    http_req_duration:       ["p(95)<5000"],
    checks:                  ["rate>0.95"],
    "init_duration":         ["p(95)<3000"],
    "slice_upload_duration": ["p(95)<3000"],
    "file_upload_duration":  ["p(95)<30000"],
  },
};

const files = new SharedArray("files", function () {
  const manifest = JSON.parse(open("../../upload-manifest.json"));
  return manifest.map((entry) => ({
    unique:      entry.unique,
    net_id:      entry.user_net_id,
    file_size:   entry.file_size,
    init_body:   JSON.stringify(entry.init_body),
    slices:      entry.slices.map((p) => ({ path: p, data: open(`../../${p}`, "b") })),
  }));
});

const initDuration        = new Trend("init_duration",         true);
const sliceUploadDuration = new Trend("slice_upload_duration", true);
const fileUploadDuration  = new Trend("file_upload_duration",  true);
const sliceErrors         = new Counter("slice_errors");
const filesCompleted      = new Counter("files_completed");

export default function () {
  const entry = files[(__VU - 1) % files.length];

  if (!entry) {
    console.error(`VU ${__VU}: no entry found`);
    return;
  }

  const { unique, net_id, file_size, init_body, slices } = entry;

  const initStart = Date.now();
  const initRes = http.post(
    `${BASE_URL}/api/v2/upload/init`,
    init_body,
    { headers: { "Content-Type": "application/json" } }
  );
  initDuration.add(Date.now() - initStart);

  const initOk = check(initRes, {
    "init status 200":   (r) => r.status === 200,
    "init errCode is 0": (r) => { try { return r.json("errCode") === 0; } catch { return false; } },
  });

  if (!initOk) {
    console.error(`VU ${__VU} | init failed | status=${initRes.status} body=${initRes.body?.substring(0, 200)}`);
    return;
  }

  const status = initRes.json("data.Status");
  if (status === 1) {
    filesCompleted.add(1);
    return;
  }

  const fileStart = Date.now();
  let allSlicesOk = true;
  let uploadedBytes = 0;

  for (const slice of slices) {
    const start = uploadedBytes;
    const end   = start + slice.data.byteLength - 1;

    const sliceStart = Date.now();
    const res = http.put(
      `${BASE_URL}/api/v1/upload/range/${net_id}/${unique}`,
      slice.data,
      {
        headers: {
          "Content-Type":  "application/octet-stream",
          "Content-Range": `bytes ${start}-${end}/${file_size}`,
        },
      }
    );
    sliceUploadDuration.add(Date.now() - sliceStart);

    const ok = check(res, {
      "slice status 200":   (r) => r.status === 200,
      "slice errCode is 0": (r) => { try { return r.json("errCode") === 0; } catch { return false; } },
      "slice data is true": (r) => { try { return r.json("data") === true; } catch { return false; } },
    });

    if (!ok) {
      sliceErrors.add(1);
      allSlicesOk = false;
      console.error(`VU ${__VU} | unique=${unique} | range ${start}-${end} | status=${res.status} body=${res.body?.substring(0, 200)}`);
      break;
    }

    uploadedBytes += slice.data.byteLength;
  }

  fileUploadDuration.add(Date.now() - fileStart);

  if (allSlicesOk) filesCompleted.add(1);
}

export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename  = `reports/report_${NUM_USERS}users_${NUM_IMAGES}images_${timestamp}.html`;
  return { [filename]: htmlReport(data) };
}

export function teardown() {
  console.log("Test finished.");
}
