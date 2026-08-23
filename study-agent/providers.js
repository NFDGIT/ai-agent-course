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
  { fetchImpl = fetch } = {},
) {
  const normalizedAlias = normalizeAlias(alias);
  if (normalizedAlias.toLowerCase() === "default") {
    throw new Error("Default is reserved for the environment provider");
  }

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const headers = { Accept: "application/json" };
  if (apiKey.trim()) headers.Authorization = `Bearer ${apiKey.trim()}`;

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
    apiKey: apiKey.trim(),
    models,
    source: "custom",
  };

  providers.set(normalizedAlias.toLowerCase(), provider);
  return publicProvider(provider);
}

export function removeProvider(alias) {
  const normalizedAlias = normalizeAlias(alias);
  if (normalizedAlias.toLowerCase() === "default") {
    throw new Error("The Default provider cannot be removed");
  }
  return providers.delete(normalizedAlias.toLowerCase());
}

export function resetCustomProviders() {
  for (const [providerKey, provider] of providers) {
    if (provider.source === "custom") providers.delete(providerKey);
  }
}
