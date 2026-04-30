export const config = {
  runtime: "edge",
};

const serviceOrigin = cleanOrigin(process.env.TARGET_DOMAIN);

const BLOCKED_HEADERS = new Set([
  "connection",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

function cleanOrigin(value = "") {
  return value.trim().replace(/\/+$/, "");
}

function createServiceUrl(inputUrl) {
  const url = new URL(inputUrl);
  return `${serviceOrigin}${url.pathname}${url.search}`;
}

function isInternalHeader(name) {
  return BLOCKED_HEADERS.has(name) || name.startsWith("x-vercel-");
}

function prepareHeaders(sourceHeaders) {
  const headers = new Headers();
  let requestAddress = null;

  for (const [key, value] of sourceHeaders.entries()) {
    const name = key.toLowerCase();

    if (isInternalHeader(name)) {
      continue;
    }

    if (name === "x-real-ip") {
      requestAddress = value;
      continue;
    }

    if (name === "x-forwarded-for") {
      requestAddress ||= value;
      continue;
    }

    headers.set(key, value);
  }

  if (requestAddress) {
    headers.set("x-forwarded-for", requestAddress);
  }

  return headers;
}

function allowsPayload(method) {
  return method !== "GET" && method !== "HEAD";
}

export default async function handler(request) {
  if (!serviceOrigin) {
    return new Response("Service configuration is incomplete.", {
      status: 500,
    });
  }

  const serviceUrl = createServiceUrl(request.url);
  const method = request.method;

  try {
    return await fetch(serviceUrl, {
      method,
      headers: prepareHeaders(request.headers),
      body: allowsPayload(method) ? request.body : undefined,
      redirect: "manual",
      duplex: "half",
    });
  } catch (error) {
    console.error("Service request failed:", error);

    return new Response("Service request could not be completed.", {
      status: 502,
    });
  }
}