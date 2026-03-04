/**
 * Analytics module — PostHog integration + fallback console logging.
 *
 * Setup:
 *   1. Create free PostHog account at https://posthog.com
 *   2. Get your project API key
 *   3. Set NEXT_PUBLIC_POSTHOG_KEY in .env.local
 *
 * Events tracked:
 *   - generate_viewed:      recommendations displayed
 *   - recipe_opened:        recipe card expanded
 *   - cooked_clicked:       "作った" button pressed
 *   - shopping_list_copied: shopping memo copied
 *   - pantry_edited:        item added/updated/deleted
 *   - mode_switched:        tab switched
 */

import type { AnalyticsEvent, AnalyticsProps } from "./types";
import { getAnonymousId, isReturningUser } from "./storage";

let posthogLoaded = false;

/**
 * Initialize PostHog (call once in layout or top-level component).
 */
export function initAnalytics(): void {
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (key) {
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: "https://app.posthog.com",
        loaded: () => {
          posthogLoaded = true;
          posthog.identify(getAnonymousId());
        },
        // Don't track personal info
        autocapture: false,
        capture_pageview: true,
        persistence: "localStorage",
      });
    });
  }
}

/**
 * Track an event with optional properties.
 * Automatically attaches device type and returning user flag.
 */
export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  const enriched: AnalyticsProps = {
    ...props,
    deviceType: typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop",
    returningUser: isReturningUser(),
  };

  // Console log (always, for debugging)
  console.log(`[Analytics] ${event}`, enriched);

  // PostHog
  if (posthogLoaded && typeof window !== "undefined") {
    import("posthog-js").then(({ default: posthog }) => {
      posthog.capture(event, enriched);
    });
  }

  // Fallback: send to /api/events if PostHog is not configured
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY && typeof window !== "undefined") {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        properties: enriched,
        anonymousId: getAnonymousId(),
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {}); // fire and forget
  }
}
