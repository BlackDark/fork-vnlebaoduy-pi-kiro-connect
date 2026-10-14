import { describe, expect, it } from "vitest";
import { encodeKiroRefresh, kiroCredentialRegion, parseKiroRefresh } from "../src/refresh-token.js";

describe("refresh-token", () => {
  it("parses legacy strings without a region", () => {
    expect(parseKiroRefresh("rt|cid|sec|idc")).toEqual({
      token: "rt",
      fields: ["cid", "sec"],
      authMethod: "idc",
      region: undefined,
    });
    expect(parseKiroRefresh("rt|desktop").authMethod).toBe("desktop");
  });

  it("round-trips a region after the marker", () => {
    const refresh = encodeKiroRefresh({ token: "rt", fields: ["cid", "sec"], authMethod: "idc", region: "eu-west-1" });
    expect(refresh).toBe("rt|cid|sec|idc|eu-west-1");
    expect(parseKiroRefresh(refresh).region).toBe("eu-west-1");
  });

  it("does not misread desktop|region as idc", () => {
    const parts = parseKiroRefresh("rt|desktop|eu-west-1");
    expect(parts.authMethod).toBe("desktop");
    expect(parts.region).toBe("eu-west-1");
  });

  it("prefers the live region over the encoded one", () => {
    expect(kiroCredentialRegion({ region: "us-west-2", refresh: "rt|desktop|eu-west-1" })).toBe("us-west-2");
    expect(kiroCredentialRegion({ refresh: "rt|desktop|eu-west-1" })).toBe("eu-west-1");
    expect(kiroCredentialRegion(undefined)).toBeUndefined();
  });
});
