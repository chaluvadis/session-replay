/**
 * Privacy and data masking configuration for the Dumb Pipe SDK.
 *
 * These utilities allow customers to control what data is recorded,
 * mask sensitive fields, block elements, and sanitize URLs before
 * they are sent to the backend.
 */

/**
 * Configuration for privacy and data masking during session recording.
 */
export interface PrivacyConfig {
  /**
   * When true, all <input>, <textarea>, and <select> values are masked
   * by default unless overridden by ignore rules. Default: true.
   */
  maskAllInputs: boolean;

  /**
   * Custom function to mask text content. Receives the text and the
   * source element (if available) and returns the masked replacement.
   */
  maskTextFn?: (text: string, element?: Element) => string;

  /**
   * CSS selectors for elements whose entire subtree should be blocked
   * (not recorded at all).
   */
  blockSelector: string[];

  /**
   * CSS selectors for elements whose subtree should be ignored
   * (recorded as a placeholder, not traversed).
   */
  ignoreSelector: string[];

  /**
   * CSS class added to elements whose text content is masked.
   * Default: 'replay-mask'.
   */
  maskTextClass: string;

  /**
   * CSS class added to elements that are blocked.
   * Default: 'replay-block'.
   */
  blockClass: string;

  /**
   * CSS class added to elements that are ignored.
   * Default: 'replay-ignore'.
   */
  ignoreClass: string;

  /**
   * Whether to record canvas elements. Default: false.
   */
  recordCanvas: boolean;

  /**
   * Whether to record cross-origin iframes. Default: false.
   */
  recordCrossOriginIframes: boolean;
}

/**
 * Paranoid privacy defaults. Masks all inputs, blocks password and credit
 * card fields, and ignores common third-party trackers.
 */
export const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  maskAllInputs: true,
  maskTextFn: (text: string): string => "*".repeat(text.length),
  blockSelector: [
    '[data-replay-block]',
    'input[type="password"]',
    '[autocomplete="cc-number"]',
    '[autocomplete="cc-csc"]',
  ],
  ignoreSelector: [
    '[data-replay-ignore]',
    'iframe[src*="google.com"]',
    'iframe[src*="doubleclick.net"]',
  ],
  maskTextClass: "replay-mask",
  blockClass: "replay-block",
  ignoreClass: "replay-ignore",
  recordCanvas: false,
  recordCrossOriginIframes: false,
};

/**
 * Converts a PrivacyConfig into rrweb record() options.
 *
 * @param privacy - The privacy configuration to convert.
 * @returns An rrweb-compatible record options object.
 */
export function buildRrwebConfig(privacy: PrivacyConfig): Record<string, unknown> {
  const config: Record<string, unknown> = {
    maskAllInputs: privacy.maskAllInputs,
    blockSelector: privacy.blockSelector.join(","),
    ignoreSelector: privacy.ignoreSelector.join(","),
    maskTextClass: privacy.maskTextClass,
    blockClass: privacy.blockClass,
    ignoreClass: privacy.ignoreClass,
    recordCanvas: privacy.recordCanvas,
    recordCrossOriginIframes: privacy.recordCrossOriginIframes,
  };

  if (privacy.maskTextFn) {
    config["maskTextFn"] = privacy.maskTextFn;
  }

  return config;
}

/**
 * Sensitive query parameter names stripped from URLs by sanitizeUrl.
 */
const SENSITIVE_PARAMS = new Set([
  "token",
  "session",
  "auth",
  "api_key",
  "apikey",
  "password",
  "passwd",
  "secret",
  "access_token",
  "refresh_token",
  "apiKey",
  "accessToken",
]);

/**
 * Strips sensitive query parameters from a URL to prevent leaking
 * credentials, tokens, or session identifiers in recorded URLs.
 *
 * @param url - The URL to sanitize.
 * @returns A new URL string with sensitive query parameters removed.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    for (const param of SENSITIVE_PARAMS) {
      parsed.searchParams.delete(param);
    }

    return parsed.toString();
  } catch {
    // If the URL is not parseable, return it unchanged.
    return url;
  }
}
