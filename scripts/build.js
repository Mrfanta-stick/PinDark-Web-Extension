/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");
const archiver = require("archiver");

const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const PACKAGE_JSON_PATH = path.join(ROOT, "package.json");

/**
 * Files and folders to include in the release ZIP. Everything else is
 * excluded — dev files, source control, planning docs, build tooling.
 */
const INCLUDE_PATHS = [
  "manifest.json",
  "content",
  "popup",
  "background",
  "icons",
  "privacy-policy.html",
];

/**
 * Files to always exclude as a safety net, in case someone adds
 * INCLUDE_PATHS entries that should never ship.
 */
const EXCLUDE_NAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  ".git",
  ".gitignore",
  ".vscode",
  "node_modules",
  "package-lock.json",
  "package.json",
  "scripts",
  "store-listing",
  "README.md",
  "PLAN.md",
]);

function readVersion() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(ROOT, "manifest.json"), "utf8")
  );
  return manifest.version;
}

function cleanDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

function copyToStaging() {
  for (const rel of INCLUDE_PATHS) {
    const src = path.join(ROOT, rel);
    const dest = path.join(DIST, rel);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing required path: ${rel}`);
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      copyDir(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (EXCLUDE_NAMES.has(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

function zipStaging(version) {
  return new Promise((resolve, reject) => {
    const outName = `pindark-v${version}.zip`;
    const outPath = path.join(ROOT, outName);
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => resolve(outPath));
    archive.on("warning", (err) => {
      if (err.code === "ENOENT") console.warn("warn:", err);
      else reject(err);
    });
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(DIST, false);
    archive.finalize();
  });
}

async function main() {
  const version = readVersion();
  console.log(`Packaging PinDark v${version}...`);

  cleanDir(DIST);
  copyToStaging();

  const zipPath = await zipStaging(version);
  const size = fs.statSync(zipPath).size;
  console.log(`  staged: ${path.relative(ROOT, DIST)}/`);
  console.log(`  wrote:  ${path.relative(ROOT, zipPath)} (${(size / 1024).toFixed(1)} KB)`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
