import { afterEach, describe, expect, it, vi } from "vitest";
import { adminToken, passwordMatches } from "./admin-auth";

afterEach(() => vi.unstubAllEnvs());

describe("/admin の合言葉", () => {
  it("合っているときだけ通る（前後の空白は無視）", () => {
    vi.stubEnv("ADMIN_PASSWORD", "yuki-2026");
    expect(passwordMatches("yuki-2026")).toBe(true);
    expect(passwordMatches(" yuki-2026 ")).toBe(true);
    expect(passwordMatches("yuki-2025")).toBe(false);
    expect(passwordMatches("")).toBe(false);
  });
  it("合言葉がないときは、何を入れても通らない", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(passwordMatches("")).toBe(false);
    expect(passwordMatches("anything")).toBe(false);
  });
  it("cookie には合言葉そのものを入れない", () => {
    expect(adminToken("yuki-2026")).not.toContain("yuki");
    expect(adminToken("yuki-2026")).toBe(adminToken("yuki-2026"));
    expect(adminToken("yuki-2026")).not.toBe(adminToken("yuki-2027"));
  });
});
