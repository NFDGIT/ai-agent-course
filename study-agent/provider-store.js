import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function getProviderStorePath() {
  return process.env.PROVIDER_STORE_PATH?.trim()
    || path.join(os.homedir(), ".ai-agent-course", "providers.json");
}

export function loadProviderRecords(storePath = getProviderStorePath()) {
  try {
    const payload = JSON.parse(fs.readFileSync(storePath, "utf8"));
    if (!Array.isArray(payload)) throw new Error("provider store must contain a JSON array");
    return payload;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`Could not read provider store ${storePath}: ${error.message}`);
  }
}

export function saveProviderRecords(records, storePath = getProviderStorePath()) {
  const storeDirectory = path.dirname(storePath);
  const temporaryPath = `${storePath}.${process.pid}.tmp`;

  fs.mkdirSync(storeDirectory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporaryPath, storePath);
  fs.chmodSync(storePath, 0o600);
}
