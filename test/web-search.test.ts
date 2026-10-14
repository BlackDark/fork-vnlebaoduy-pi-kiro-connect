import { afterEach, describe, expect, it, vi } from "vitest";
import { invokeKiroWebSearch, KiroWebSearchError } from "../src/web-search.js";

const auth = {
  accessToken: "test-access-token",
  region: "us-east-1",
  profileArn: "arn:aws:codewhisperer:us-east-1:123456789012:profile/test",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Kiro web_search (InvokeMCP)", () => {
  it("posts a tools/call JSON-RPC request to the /mcp endpoint with the required UA headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          error: null,
          id: "x",
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  results: [
                    { title: "A", url: "https://a.example", snippet: "s", publishedDate: 1, domain: "a.example" },
                  ],
                }),
              },
            ],
          },
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const results = await invokeKiroWebSearch(auth, "today's top tech news");

    expect(results).toEqual([
      { title: "A", url: "https://a.example", snippet: "s", publishedDate: 1, domain: "a.example" },
    ]);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe("https://runtime.us-east-1.kiro.dev/mcp");
    expect(request.method).toBe("POST");
    expect(request.headers.Authorization).toBe("Bearer test-access-token");
    expect(request.headers["user-agent"]).toMatch(/^aws-sdk-rust\/1\.0\.0/);
    expect(request.headers["x-amz-user-agent"]).toBe(request.headers["user-agent"]);
    expect(request.headers["x-amzn-codewhisperer-optout"]).toBe("true");
    const body = JSON.parse(request.body);
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      profileArn: auth.profileArn,
      params: { name: "web_search", arguments: { query: "today's top tech news" } },
    });
  });

  it("throws KiroWebSearchError on a JSON-RPC error envelope (HTTP 200)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ error: { code: -32602, message: "Tool not found" }, id: "x", jsonrpc: "2.0", result: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeKiroWebSearch(auth, "q")).rejects.toThrow(KiroWebSearchError);
    await expect(invokeKiroWebSearch(auth, "q")).rejects.toThrow("Tool not found");
  });

  it("throws KiroWebSearchError on an HTTP-level failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403, statusText: "Forbidden" });
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeKiroWebSearch(auth, "q")).rejects.toThrow(/403/);
  });

  it("throws KiroWebSearchError when the result has no content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: null, id: "x", jsonrpc: "2.0", result: { content: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeKiroWebSearch(auth, "q")).rejects.toThrow(KiroWebSearchError);
  });
});
