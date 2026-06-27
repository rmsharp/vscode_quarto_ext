import { describe, expect, it } from "vitest";
import {
  meetsMinimum,
  MINIMUM_QUARTO_VERSION,
  parseQuartoVersion,
  toSemVer,
} from "../../src/core/version";

describe("parseQuartoVersion", () => {
  it("parses the bare version line printed by `quarto --version`", () => {
    // Verified live against Quarto 1.7.33: stdout is exactly "1.7.33\n".
    expect(parseQuartoVersion("1.7.33\n")).toBe("1.7.33");
  });

  it("extracts a semver from surrounding banner text", () => {
    expect(parseQuartoVersion("quarto version 1.7.33 (build 9)")).toBe("1.7.33");
  });

  it("returns null when no version token is present", () => {
    expect(parseQuartoVersion("command not found")).toBeNull();
  });
});

describe("toSemVer", () => {
  it("parses into structured fields", () => {
    expect(toSemVer("1.7.33")).toEqual({ major: 1, minor: 7, patch: 33 });
  });

  it("tolerates trailing pre-release text", () => {
    expect(toSemVer("1.8.0-beta1")).toEqual({ major: 1, minor: 8, patch: 0 });
  });

  it("returns null on garbage", () => {
    expect(toSemVer("not-a-version")).toBeNull();
  });
});

describe("meetsMinimum", () => {
  it("accepts the installed 1.7.33 against the 1.7.0 floor", () => {
    expect(meetsMinimum("1.7.33", MINIMUM_QUARTO_VERSION)).toBe(true);
  });

  it("accepts an exact match", () => {
    expect(meetsMinimum("1.7.0")).toBe(true);
  });

  it("rejects an older patch", () => {
    expect(meetsMinimum("1.6.40")).toBe(false);
  });

  it("rejects an older major", () => {
    expect(meetsMinimum("0.9.0")).toBe(false);
  });

  it("accepts a newer major", () => {
    expect(meetsMinimum("2.0.0")).toBe(true);
  });

  it("treats unparseable input as not meeting the minimum", () => {
    expect(meetsMinimum("")).toBe(false);
  });
});
