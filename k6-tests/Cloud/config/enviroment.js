const environments = {
  dev: {
    baseUrl: "",
  },
  qa: {
    baseUrl: "https://node1.17qpb.com:3065",
  },
};

const MANIFEST_PATH = "../../../data/upload-manifest.json";

const envName = __ENV.ENV || "qa"; // default qa if haven't param -e ENV=
const current = environments[envName];

if (!current) {
  throw new Error(
    `Unknown ENV "${envName}". Valid options: ${Object.keys(environments).join(", ")}`,
  );
}

if (!current.baseUrl) {
  throw new Error(
    `baseUrl for ENV "${envName}" is empty. Set it in config/enviroment.js first.`,
  );
}

export const BASE_URL = current.baseUrl;
export { MANIFEST_PATH };
export const ENV_NAME = envName;
