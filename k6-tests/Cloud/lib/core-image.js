import http from "k6/http";
import { check } from "k6";
import { Counter, Trend } from "k6/metrics";
import { SharedArray } from "k6/data";
import encoding from "k6/encoding";
import { BASE_URL, MANIFEST_PATH } from "../config/enviroment.js";

const REQ_TIMEOUT = "15s";

const _allEntries = new SharedArray("files", function () {
  const manifest = JSON.parse(open(MANIFEST_PATH));
  return manifest.map((entry) => ({
    unique:    entry.unique,
    net_id:    entry.user_net_id,
    file_size: entry.file_size,
    init_body: JSON.stringify(entry.init_body),
    slicesB64: entry.slices.map((p) =>
      encoding.b64encode(open(`../../../${p.replace(/\\/g, "/")}`, "b"))
    ),
  }));
});

function _buildEntry(idx) {
  const meta = _allEntries[idx];
  return {
    unique:    meta.unique,
    net_id:    meta.net_id,
    file_size: meta.file_size,
    init_body: meta.init_body,
    slices:    meta.slicesB64.map((b64) => ({ data: encoding.b64decode(b64) })),
  };
}

export function getEntryByVU() {
  const idx = __VU > 0 ? (__VU - 1) % _allEntries.length : 0;
  return _buildEntry(idx);
}

export function getEntryByIteration() {
  const idx = __ITER % _allEntries.length;
  return _buildEntry(idx);
}

export const initDuration        = new Trend("init_duration",         true);
export const sliceUploadDuration = new Trend("slice_upload_duration", true);
export const fileUploadDuration  = new Trend("file_upload_duration",  true);
export const sliceErrors         = new Counter("slice_errors");
export const filesCompleted      = new Counter("files_completed");

export const thresholds = {
  http_req_failed:         ["rate<0.05"],
  checks:                  ["rate>0.95"],
  "init_duration":         ["p(95)<5000"],
  "slice_upload_duration": ["p(95)<10000"],
  "file_upload_duration":  ["p(95)<10000"],
  "http_req_duration":     ["p(95)<10000"],
};

export function runUpload(entry) {
  if (!entry) {
    console.error(`VU ${__VU}: no entry`);
    return;
  }

  const { unique, net_id, file_size, init_body, slices } = entry;

  const initStart = Date.now();
  const initRes = http.post(
    `${BASE_URL}/api/v2/upload/init`,
    init_body,
    { headers: { "Content-Type": "application/json" }, timeout: REQ_TIMEOUT }
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
        timeout: REQ_TIMEOUT,
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
