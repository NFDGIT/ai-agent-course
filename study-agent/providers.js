import {
  getProviderStorePath,
  loadProviderRecords,
  saveProviderRecords,
} from "./provider-store.js";

const defaultProvider = {
  alias: "Default",
  baseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
  models: [process.env.OPENAI_MODEL || "gpt-5.4"],
  source: "environment",
};

const providers = new Map([[defaultProvider.alias.toLowerCase(), defaultProvider]]);

function normalizeAlias(alias) {
  const normalizedAlias = alias?.trim();
  if (!normalizedAlias) throw new Error("provider alias is required");
  if (normalizedAlias.length > 50) throw new Error("provider alias must be 50 characters or fewer");
  if (!/^[a-zA-Z0-9 _.-]+$/.test(normalizedAlias)) {
    throw new Error("provider alias may contain letters, numbers, spaces, dots, dashes, and underscores");
  }
  return normalizedAlias;
}

function normalizeBaseUrl(baseUrl) {
  let parsedUrl;
  try {
    parsedUrl = new URL(baseUrl?.trim());
  } catch {
    throw new Error("API base URL must be a valid URL");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("API base URL must use http or https");
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error("API base URL must not contain credentials");
  }

  return parsedUrl.toString().replace(/\/$/, "");
}

function normalizeApiKey(apiKey = "") {
  return apiKey.trim().replace(/^Bearer\s+/i, "");
}

function publicProvider(provider) {
  return {
    alias: provider.alias,
    baseUrl: provider.baseUrl,
    models: [...provider.models],
    source: provider.source,
    hasApiKey: Boolean(provider.apiKey),
  };
}

function extractModelIds(payload) {
  const modelItems = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];

  return [...new Set(
    modelItems
      .map((model) => {
        if (typeof model === "string") return model;
        return model?.id || model?.name || model?.model;
      })
      .filter((modelId) => typeof modelId === "string" && modelId.trim())
      .map((modelId) => modelId.trim()),
  )].sort((first, second) => first.localeCompare(second));
}

function customProviderRecords(replacementProvider) {
  const customProviders = [...providers.values()].filter(
    (provider) => provider.source === "custom" && provider.alias.toLowerCase() !== replacementProvider?.alias.toLowerCase(),
  );
  if (replacementProvider) customProviders.push(replacementProvider);

  return customProviders.map((provider) => ({
    alias: provider.alias,
    baseUrl: provider.baseUrl,
    apiKey: provider.apiKey,
    models: [...provider.models],
  }));
}

function loadStoredProviders() {
  let records;
  try {
    records = loadProviderRecords();
  } catch (error) {
    console.warn(error.message);
    return;
  }

  for (const record of records) {
    try {
      const provider = {
        alias: normalizeAlias(record.alias),
        baseUrl: normalizeBaseUrl(record.baseUrl),
        apiKey: normalizeApiKey(record.apiKey),
        models: extractModelIds({ models: record.models }),
        source: "custom",
      };
      if (provider.alias.toLowerCase() === "default" || provider.models.length === 0) continue;
      providers.set(provider.alias.toLowerCase(), provider);
    } catch (error) {
      console.warn(`Skipped an invalid stored provider: ${error.message}`);
    }
  }
}

loadStoredProviders();

export function listProviders() {
  return [...providers.values()].map(publicProvider);
}

export function getProvider(alias = "Default") {
  const provider = providers.get(alias.trim().toLowerCase());
  if (!provider) throw new Error(`Unknown provider: ${alias}`);
  return provider;
}

export function selectProviderModel(provider, requestedModel) {
  const model = requestedModel?.trim() || provider.models[0];
  if (!model) throw new Error(`Provider ${provider.alias} has no available models`);
  if (!provider.models.includes(model)) {
    throw new Error(`Model ${model} is not available from provider ${provider.alias}`);
  }
  return model;
}

export async function discoverProvider(
  { alias, baseUrl, apiKey = "" },
  { fetchImpl = fetch, persist = true, storePath = getProviderStorePath() } = {},
) {
  const normalizedAlias = normalizeAlias(alias);
  if (normalizedAlias.toLowerCase() === "default") {
    throw new Error("Default is reserved for the environment provider");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedApiKey = normalizeApiKey(apiKey);
  const headers = { Accept: "application/json" };
  if (normalizedApiKey) headers.Authorization = `Bearer ${normalizedApiKey}`;

  let modelResponse;
  try {
    modelResponse = await fetchImpl(`${normalizedBaseUrl}/models`, {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    throw new Error(`Could not connect to ${normalizedBaseUrl}/models: ${error.message}`);
  }

  if (!modelResponse.ok) {
    const responseText = await modelResponse.text();
    if (modelResponse.status === 401) {
      throw new Error(
        "The provider rejected the API key (HTTP 401). Paste a valid raw API key without quotes or a Bearer prefix.",
      );
    }
    throw new Error(
      `Model discovery failed with HTTP ${modelResponse.status}${responseText ? `: ${responseText.slice(0, 180)}` : ""}`,
    );
  }

  const payload = await modelResponse.json();
  const models = extractModelIds(payload);
  if (models.length === 0) {
    throw new Error("The provider returned no model IDs from its /models endpoint");
  }

  const provider = {
    alias: normalizedAlias,
    baseUrl: normalizedBaseUrl,
    apiKey: normalizedApiKey,
    models,
    source: "custom",
  };

  if (persist) saveProviderRecords(customProviderRecords(provider), storePath);
  providers.set(normalizedAlias.toLowerCase(), provider);
  return publicProvider(provider);
}

export function removeProvider(alias, { persist = true, storePath = getProviderStorePath() } = {}) {
  const normalizedAlias = normalizeAlias(alias);
  if (normalizedAlias.toLowerCase() === "default") {
    throw new Error("The Default provider cannot be removed");
  }
  if (!providers.has(normalizedAlias.toLowerCase())) return false;
  if (persist) {
    const remainingProviders = customProviderRecords().filter(
      (provider) => provider.alias.toLowerCase() !== normalizedAlias.toLowerCase(),
    );
    saveProviderRecords(remainingProviders, storePath);
  }
  return providers.delete(normalizedAlias.toLowerCase());
}

export function resetCustomProviders({ persist = false, storePath = getProviderStorePath() } = {}) {
  if (persist) saveProviderRecords([], storePath);
  for (const [providerKey, provider] of providers) {
    if (provider.source === "custom") providers.delete(providerKey);
  }
}
