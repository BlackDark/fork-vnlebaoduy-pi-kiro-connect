import type { Api, Model, ThinkingLevel } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { buildKiroAdditionalModelRequestFields, fallbackKiroEffort } from "../src/effort.js";
import { mapKiroCatalogModels } from "../src/models.js";

const FIVE_LEVELS = ["low", "medium", "high", "xhigh", "max"];

function modelFor(kiroModelId: string): Model<Api> {
  const [mapped] = mapKiroCatalogModels([{ modelId: kiroModelId }], "us-east-1");
  return mapped as unknown as Model<Api>;
}

function effortSent(kiroModelId: string, level: ThinkingLevel) {
  return buildKiroAdditionalModelRequestFields(modelFor(kiroModelId), kiroModelId, level);
}

describe("schema-less effort fallback", () => {
  it.each([
    "claude-opus-4.8",
    "claude-opus-4.7",
    "claude-sonnet-5",
    "claude-fable-5",
    "claude-fable-5.1",
    "claude-opus-5",
    "claude-opus-5.5",
    "claude-sonnet-5.5",
    "claude-haiku-5.5",
  ])("%s supports all five effort levels", (id) => {
    expect(fallbackKiroEffort(id)?.values).toEqual(FIVE_LEVELS);
  });

  it.each(["claude-opus-4.6", "claude-sonnet-4.6"])("%s has no xhigh", (id) => {
    expect(fallbackKiroEffort(id)?.values).toEqual(["low", "medium", "high", "max"]);
  });

  it.each(["claude-haiku-4.5", "claude-sonnet-4.5", "claude-sonnet-4"])("%s has no structured effort", (id) => {
    expect(fallbackKiroEffort(id)).toBeUndefined();
  });

  it.each(["claude-opus-5-5", "claude-haiku-5-5"])("accepts pi-style dashed id %s", (id) => {
    expect(fallbackKiroEffort(id)).toBeDefined();
  });
});

describe("request effort for 5.5 models", () => {
  it.each(["claude-opus-5.5", "claude-sonnet-5.5", "claude-haiku-5.5"])("%s sends xhigh and max as-is", (id) => {
    expect(effortSent(id, "xhigh")).toMatchObject({ output_config: { effort: "xhigh" } });
    expect(effortSent(id, "max")).toMatchObject({ output_config: { effort: "max" } });
    expect(effortSent(id, "minimal")).toMatchObject({ output_config: { effort: "low" } });
  });

  it("clamps xhigh to max on Opus 4.6", () => {
    expect(effortSent("claude-opus-4.6", "xhigh")).toMatchObject({ output_config: { effort: "max" } });
  });

  it("sends nothing for Haiku 4.5", () => {
    expect(effortSent("claude-haiku-4.5", "high")).toBeUndefined();
  });
});
