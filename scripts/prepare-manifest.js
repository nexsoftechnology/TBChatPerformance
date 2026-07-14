const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");

const INDEX_DIR    = process.env.INDEX_DIR    || path.join(ROOT_DIR, "genfile", "upload", "index");
const UPLOAD_DIR   = process.env.UPLOAD_DIR   || path.join(ROOT_DIR, "genfile", "upload", "upload");
const MANIFEST_OUT = process.env.MANIFEST_OUT || path.join(ROOT_DIR, "data", "upload-manifest-image.json");

function toRootRelative(p) {
  return path.relative(ROOT_DIR, p).split(path.sep).join("/");
}

function main() {
  const indexFiles = fs.readdirSync(INDEX_DIR);

  if (indexFiles.length === 0) {
    console.error(`No index files found in ${INDEX_DIR}. Run buildFileTool.exe first.`);
    process.exit(1);
  }

  console.log(`Building manifest from ${indexFiles.length} index files...`);

  const manifest = [];
  const errors = [];

  for (const filename of indexFiles) {
    const indexPath = path.join(INDEX_DIR, filename);
    try {
      const initBody = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      const unique = initBody.unique;
      const slicePath = path.join(UPLOAD_DIR, `http_${unique}_`);

      manifest.push({
        unique,
        user_net_id: initBody.user_net_id,
        file_size:   initBody.file_size,
        init_body:   initBody,
        slices:      [toRootRelative(slicePath)],
      });
    } catch (err) {
      errors.push({ file: indexPath, error: err.message });
      console.error(`  ERROR: ${indexPath} — ${err.message}`);
    }
  }

  fs.mkdirSync(path.dirname(MANIFEST_OUT), { recursive: true });
  fs.writeFileSync(MANIFEST_OUT, JSON.stringify(manifest, null, 2));

  console.log(`\nDone!`);
  console.log(`  Manifest entries : ${manifest.length}`);
  console.log(`  Errors           : ${errors.length}`);
  console.log(`  Output           : ${MANIFEST_OUT}`);

  if (errors.length > 0) process.exit(1);
}

main();
