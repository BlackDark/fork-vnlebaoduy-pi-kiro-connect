// ABOUTME: Calls Kiro's server-side web_search tool over the InvokeMCP JSON-RPC operation.
// ABOUTME: Separate wire path from generateAssistantResponse (POST /mcp, not /generateAssistantResponse).

import { randomUUID } from "node:crypto";
import { formatSafeError, redactSensitiveText } from "./debug.js";
import { getKiroEndpoints } from "./endpoints.js";
import { kiroAuthHeaders } from "./oauth.js";
import { kiroTokenTypeHeaders } from "./token-type.js";

export interface KiroWebSearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate: number | null;
  domain: string;
  [key: string]: unknown;
}

export interface KiroWebSearchAuth {
  accessToken: string;
  region: string;
  profileArn: string;
}

/** Thrown for an InvokeMCP JSON-RPC error (HTTP 200, `error` set) or an HTTP-level failure. */
export class KiroWebSearchError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "KiroWebSearchError";
  }
}

interface InvokeMcpToolCallResponse {
  error?: { code?: number; message?: string } | null;
  result?: { content?: Array<{ type?: string; text?: string }> } | null;
}

/**
 * Note: the `user-agent`/`x-amz-user-agent` strings are required — Kiro
 * answers 403 without them, even with a valid token.
 */
export async function invokeKiroWebSearch(auth: KiroWebSearchAuth, query: string): Promise<KiroWebSearchResult[]> {
  const endpoint = new URL("mcp", getKiroEndpoints(auth.region).runtime).toString();
  const mid = randomUUID().replace(/-/g, "");
  const ua = `aws-sdk-rust/1.0.0 ua/2.1 os/other lang/rust api/codewhispererstreaming#1.28.3 m/E app/AmazonQ-For-CLI md/appVersion-1.28.3-${mid}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...kiroAuthHeaders(auth.accessToken),
      ...kiroTokenTypeHeaders(auth.accessToken),
      "x-amzn-codewhisperer-optout": "true",
      "amz-sdk-invocation-id": randomUUID(),
      "amz-sdk-request": "attempt=1; max=1",
      "x-amz-user-agent": ua,
      "user-agent": ua,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: randomUUID(),
      method: "tools/call",
      profileArn: auth.profileArn,
      params: { name: "web_search", arguments: { query } },
    }),
  });

  if (!response.ok) {
    const statusText = response.statusText ? ` ${redactSensitiveText(response.statusText)}` : "";
    throw new KiroWebSearchError(`Kiro web_search failed: ${response.status}${statusText}`);
  }

  let body: InvokeMcpToolCallResponse;
  try {
    body = (await response.json()) as InvokeMcpToolCallResponse;
  } catch (error) {
    throw new KiroWebSearchError(`Kiro web_search returned invalid JSON: ${formatSafeError(error)}`);
  }

  if (body.error) {
    throw new KiroWebSearchError(body.error.message ?? "Kiro web_search returned an error", body.error.code);
  }

  // result.content[0].text is itself a JSON string carrying {results: [...]}.
  const text = body.result?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new KiroWebSearchError("Kiro web_search returned no result content");
  }

  let parsed: { results?: unknown };
  try {
    parsed = JSON.parse(text) as { results?: unknown };
  } catch (error) {
    throw new KiroWebSearchError(`Kiro web_search result was not valid JSON: ${formatSafeError(error)}`);
  }

  if (!Array.isArray(parsed.results)) {
    throw new KiroWebSearchError("Kiro web_search result missing a results array");
  }

  return parsed.results as KiroWebSearchResult[];
}
