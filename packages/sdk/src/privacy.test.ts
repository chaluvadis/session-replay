import { describe, it, expect } from "vitest";
import {
  DEFAULT_PRIVACY_CONFIG,
  buildRrwebConfig,
  sanitizeUrl,
} from "./privacy";

describe("DEFAULT_PRIVACY_CONFIG", () => {
  it("maskAllInputs is true", () => {
    expect(DEFAULT_PRIVACY_CONFIG.maskAllInputs).toBe(true);
  });

  it("maskTextFn replaces all characters with '*'", () => {
    const result = DEFAULT_PRIVACY_CONFIG.maskTextFn!("sensitive data");
    expect(result).toBe("**************");
  });

  it("blockSelector includes password fields", () => {
    expect(DEFAULT_PRIVACY_CONFIG.blockSelector).toContain(
      'input[type="password"]',
    );
  });

  it("blockSelector includes credit card autocomplete fields", () => {
    expect(DEFAULT_PRIVACY_CONFIG.blockSelector).toContain(
      '[autocomplete="cc-number"]',
    );
    expect(DEFAULT_PRIVACY_CONFIG.blockSelector).toContain(
      '[autocomplete="cc-csc"]',
    );
  });

  it("ignoreSelector includes third-party tracker iframes", () => {
    expect(DEFAULT_PRIVACY_CONFIG.ignoreSelector).toContain(
      'iframe[src*="google.com"]',
    );
    expect(DEFAULT_PRIVACY_CONFIG.ignoreSelector).toContain(
      'iframe[src*="doubleclick.net"]',
    );
  });

  it("recordCanvas defaults to false", () => {
    expect(DEFAULT_PRIVACY_CONFIG.recordCanvas).toBe(false);
  });

  it("recordCrossOriginIframes defaults to false", () => {
    expect(DEFAULT_PRIVACY_CONFIG.recordCrossOriginIframes).toBe(false);
  });

  it("CSS class defaults are set", () => {
    expect(DEFAULT_PRIVACY_CONFIG.maskTextClass).toBe("replay-mask");
    expect(DEFAULT_PRIVACY_CONFIG.blockClass).toBe("replay-block");
    expect(DEFAULT_PRIVACY_CONFIG.ignoreClass).toBe("replay-ignore");
  });
});

describe("buildRrwebConfig", () => {
  it("maps privacy config to rrweb options", () => {
    const config = buildRrwebConfig(DEFAULT_PRIVACY_CONFIG);

    expect(config.maskAllInputs).toBe(true);
    expect(config.blockSelector).toBe(
      '[data-replay-block],input[type="password"],[autocomplete="cc-number"],[autocomplete="cc-csc"]',
    );
    expect(config.ignoreSelector).toBe(
      '[data-replay-ignore],iframe[src*="google.com"],iframe[src*="doubleclick.net"]',
    );
    expect(config.maskTextClass).toBe("replay-mask");
    expect(config.blockClass).toBe("replay-block");
    expect(config.ignoreClass).toBe("replay-ignore");
    expect(config.recordCanvas).toBe(false);
    expect(config.recordCrossOriginIframes).toBe(false);
    expect(config.maskTextFn).toBeDefined();
  });
});

describe("sanitizeUrl", () => {
  it("strips sensitive query parameters", () => {
    const url = "https://example.com/page?token=abc123&session=xyz&normal=1";
    expect(sanitizeUrl(url)).toBe("https://example.com/page?normal=1");
  });

  it("strips multiple sensitive params", () => {
    const url =
      "https://example.com/page?auth=bearer&api_key=key123&password=secret&access_token=tok";
    expect(sanitizeUrl(url)).toBe("https://example.com/page");
  });

  it("strips accessToken and apiKey (camelCase variants)", () => {
    const url = "https://example.com/page?accessToken=tok&apiKey=key";
    expect(sanitizeUrl(url)).toBe("https://example.com/page");
  });

  it("preserves non-sensitive query parameters", () => {
    const url = "https://example.com/page?utm_source=google&utm_medium=cpc";
    expect(sanitizeUrl(url)).toBe(
      "https://example.com/page?utm_source=google&utm_medium=cpc",
    );
  });

  it("returns URL unchanged if unparseable", () => {
    expect(sanitizeUrl("not-a-valid-url")).toBe("not-a-valid-url");
  });

  it("handles URL with no query parameters", () => {
    expect(sanitizeUrl("https://example.com/page")).toBe(
      "https://example.com/page",
    );
  });

  it("handles URL with only sensitive parameters", () => {
    expect(sanitizeUrl("https://example.com/page?token=abc")).toBe(
      "https://example.com/page",
    );
  });
});
