import test from "node:test";
import assert from "node:assert/strict";

import {
  discoverProvider,
  getProvider,
  listProviders,
  resetCustomProviders,
  selectProviderModel,
} from "../providers.js";

test("discovers and stores models without exposing the API key", async () => {
  resetCustomProviders();
  const fakeFetch = async (url, options) => {
    assert.equal(url, "https://example.test/v1/models");
    assert.equal(options.headers.Authorization, "Bearer secret-key");
    return {
      ok: true,
      json: async () => ({ data: [{ id: "model-b" }, { id: "model-a" }] }),
    };
  };

  const provider = await discoverProvider(
    { alias: "Example", baseUrl: "https://example.test/v1/", apiKey: "Bearer secret-key" },
    { fetchImpl: fakeFetch, persist: false },
  );

  assert.deepEqual(provider.models, ["model-a", "model-b"]);
  assert.equal(provider.hasApiKey, true);
  assert.equal("apiKey" in provider, false);
  assert.equal(getProvider("example").apiKey, "secret-key");
});

test("explains how to recover from an invalid provider token", async () => {
  await assert.rejects(
    discoverProvider(
      { alias: "Invalid", baseUrl: "https://example.test/v1", apiKey: "wrong-key" },
      {
        persist: false,
        fetchImpl: async () => ({
          ok: false,
          status: 401,
          text: async () => '{"error":"invalid token"}',
        }),
      },
    ),
    /valid raw API key without quotes or a Bearer prefix/,
  );
});

test("selects only models discovered for the provider", () => {
  const provider = { alias: "Example", models: ["model-a", "model-b"] };
  assert.equal(selectProviderModel(provider, "model-b"), "model-b");
  assert.throws(() => selectProviderModel(provider, "missing-model"), /is not available/);
});

test("lists the environment provider and custom providers", async () => {
  resetCustomProviders();
  await discoverProvider(
    { alias: "Example", baseUrl: "https://example.test/v1" },
    {
      persist: false,
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({ data: [{ id: "model-a" }] }),
      }),
    },
  );
  const aliases = listProviders().map((provider) => provider.alias);
  assert.deepEqual(aliases, ["Default", "Example"]);
});
