import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = "feb7bd3ce238b8ba1fc61e69fa2a4e06";

const isProductionOrStaging =
  process.env.NODE_ENV !== "development" &&
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost";

let initialized = false;

export const initMixpanel = () => {
  if (initialized || !isProductionOrStaging) return;

  // We do not want to initialize for /f/ routes
  if (window.location.pathname.startsWith("/f/")) {
    return;
  }

  mixpanel.init(MIXPANEL_TOKEN, {
    autocapture: true,
    record_sessions_percent: 100,
  });
  initialized = true;
};

export const trackEvent = (eventName: string, props?: Record<string, any>) => {
  if (!initialized || !isProductionOrStaging) return;
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/f/")
  )
    return;

  mixpanel.track(eventName, props);
};

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (!initialized || !isProductionOrStaging) return;
  if (
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/f/")
  )
    return;

  mixpanel.identify(userId);
  if (traits) {
    mixpanel.people.set(traits);
  }
};

export const resetMixpanel = () => {
  if (!initialized || !isProductionOrStaging) return;
  mixpanel.reset();
};
