const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Use the version from package.json as the tag
const PACKAGE_VERSION = require("../../package.json").version;
const BINARY_TAG = `v${PACKAGE_VERSION}`;
const CACHE_DIR = path.join(require("os").homedir(), ".vibe-kanban", "bin");

// Local development mode: only activate if explicitly requested via env var
const LOCAL_DIST_DIR = path.join(__dirname, "..", "dist");
const LOCAL_DEV_MODE = process.env.VIBE_KANBAN_LOCAL === "1";

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse JSON from ${url}`));
        }
      });
    }).on("error", reject);
  });
}

async function downloadFile(url, destPath, expectedSha256, onProgress) {
  const tempPath = destPath + ".tmp";
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempPath);
    const hash = crypto.createHash("sha256");

    const cleanup = () => {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    };

    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        cleanup();
        return downloadFile(res.headers.location, destPath, expectedSha256, onProgress)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        file.close();
        cleanup();
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`));
      }

      const totalSize = parseInt(res.headers["content-length"], 10);
      let downloadedSize = 0;

      res.on("data", (chunk) => {
        downloadedSize += chunk.length;
        hash.update(chunk);
        if (onProgress) onProgress(downloadedSize, totalSize);
      });
      res.pipe(file);

      file.on("finish", () => {
        file.close();
        const actualSha256 = hash.digest("hex");
        if (expectedSha256 && actualSha256 !== expectedSha256) {
          cleanup();
          reject(new Error(`Checksum mismatch: expected ${expectedSha256}, got ${actualSha256}`));
        } else {
          try {
            fs.renameSync(tempPath, destPath);
            resolve(destPath);
          } catch (err) {
            cleanup();
            reject(err);
          }
        }
      });
    }).on("error", (err) => {
      file.close();
      cleanup();
      reject(err);
    });
  });
}

async function ensureBinary(platform, binaryName, onProgress) {
  // In local dev mode, use binaries directly from npx-cli/dist/
  if (LOCAL_DEV_MODE) {
    const localZipPath = path.join(LOCAL_DIST_DIR, platform, `${binaryName}.zip`);
    if (fs.existsSync(localZipPath)) {
      return localZipPath;
    }
    throw new Error(
      `Local binary not found: ${localZipPath}\n` +
      `Run ./local-build.sh first to build the binaries.`
    );
  }

  const cacheDir = path.join(CACHE_DIR, BINARY_TAG, platform);
  const zipPath = path.join(cacheDir, `${binaryName}.zip`);

  if (fs.existsSync(zipPath)) return zipPath;

  fs.mkdirSync(cacheDir, { recursive: true });

  // Download from GitHub Releases
  // Asset name convention: {binaryName}-{platform}.zip
  // e.g. vibe-kanban-linux-x64.zip
  const url = `https://github.com/hushhenry/vibe-kanban/releases/download/${BINARY_TAG}/${binaryName}-${platform}.zip`;
  
  // We skip SHA256 verification since we don't have a manifest
  await downloadFile(url, zipPath, null, onProgress);

  return zipPath;
}

async function getLatestVersion() {
  // For now, assume current version is latest to avoid complex API checks
  return PACKAGE_VERSION;
}

module.exports = { BINARY_TAG, CACHE_DIR, LOCAL_DEV_MODE, LOCAL_DIST_DIR, ensureBinary, getLatestVersion };
