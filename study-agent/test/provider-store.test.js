import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadProviderRecords, saveProviderRecords } from "../provider-store.js";

test("stores providers locally and reloads them on startup", async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "study-agent-providers-"));
  const storePath = path.join(temporaryDirectory, "providers.json");
  const originalStorePath = process.env.PROVIDER_STORE_PATH;

  try {
    saveProviderRecords([
      {
        alias: "Local Test",
        baseUrl: "https://example.test/v1",
        apiKey: "secret-key",
        models: ["model-a"],
      },
    ], storePath);

    assert.equal(fs.statSync(storePath).mode & 0o777, 0o600);
    assert.equal(loadProviderRecords(storePath)[0].apiKey, "secret-key");

    process.env.PROVIDER_STORE_PATH = storePath;
    const providersModule = await import(`../providers.js?store-test=${Date.now()}`);
    assert.equal(providersModule.getProvider("Local Test").models[0], "model-a");
    assert.equal(providersModule.getProvider("Local Test").apiKey, "secret-key");
  } finally {
    if (originalStorePath === undefined) delete process.env.PROVIDER_STORE_PATH;
    else process.env.PROVIDER_STORE_PATH = originalStorePath;
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});
