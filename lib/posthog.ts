import posthog from "posthog-js";

const POSTHOG_KEY = "phc_1RXnVRJOrHdRjhLXg1SAnQnqyzEeG0bo5cTGI8IzM6Z";
const POSTHOG_HOST = "https://us.i.posthog.com";

export const initPostHog = () => {
  if (typeof window !== "undefined") {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: true,
      capture_pageleave: true,
      autocapture: true,
      session_recording: {
        maskAllInputs: false,
        maskInputFn: (text: string, element?: HTMLElement) => {
          // Don't mask form inputs so we can see what users type
          return text;
        },
      },
      persistence: "localStorage+cookie",
      loaded: (posthog: any) => {
        if (process.env.NODE_ENV === "development") {
          // Optionally disable in dev
          // posthog.opt_out_capturing();
        }
      },
    });
  }
  return posthog;
};

// Identify user when they provide contact info
export const identifyUser = (email?: string, name?: string, phone?: string) => {
  if (!email && !name && !phone) return;

  const userId = email || phone || name;
  if (userId) {
    posthog.identify(userId, {
      email: email || undefined,
      name: name || undefined,
      phone: phone || undefined,
    });
  }
};

// Track custom events
export const trackEvent = (
  eventName: string,
  properties?: Record<string, unknown>,
) => {
  posthog.capture(eventName, properties);
};

// Link anonymous session to form
export const trackFormStart = (formId: string, formName?: string) => {
  posthog.capture("form_started", {
    form_id: formId,
    form_name: formName,
  });
};

export const trackFormSubmission = (formId: string, formName?: string) => {
  posthog.capture("form_submitted", {
    form_id: formId,
    form_name: formName,
  });
};

export { posthog };
