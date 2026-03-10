import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

const VISITOR_ID_KEY = "mirour_visitor_id";

// ── Visitor ID (device fingerprint persisted in localStorage) ─────────────────

const generateVisitorId = (): string => "v_" + uuidv4();

export const getOrCreateVisitorId = (): string => {
  if (typeof window === "undefined") return generateVisitorId();
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = generateVisitorId();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
  }
  return visitorId;
};

// ── Device type detection ─────────────────────────────────────────────────────

const getDeviceType = (): "mobile" | "tablet" | "desktop" => {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|opera mini|windows phone/i.test(ua))
    return "mobile";
  return "desktop";
};

const getOS = (): string => {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) return "Windows";
  if (/mac/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  if (/android/i.test(ua)) return "Android";
  if (/ipad|iphone|ipod/i.test(ua)) return "iOS";
  return "Unknown";
};

const getBrowser = (): string => {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/chrome|crios/i.test(ua) && !/edge|edg|opr|brave/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua) && !/chrome|crios|opr|edg/i.test(ua)) return "Safari";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/edg/i.test(ua)) return "Edge";
  if (/opr/i.test(ua)) return "Opera";
  return "Unknown";
};

// ── Main hook ─────────────────────────────────────────────────────────────────

export const useFormAnalytics = (formId: string | undefined) => {
  const sessionIdRef      = useRef<string | null>(null);
  const visitorIdRef      = useRef<string>(getOrCreateVisitorId());
  const visitedNodesRef   = useRef<string[]>([]);
  const partialAnswersRef = useRef<Record<string, unknown>>({});
  const sessionStartRef   = useRef<number | null>(null); // Date.now() at session start
  const nodeStartRef      = useRef<number | null>(null); // Date.now() at node entrance

  // Queue for updates that arrive before the session INSERT completes
  const pendingUpdatesRef = useRef<
    Array<{ nodeId: string; answer?: { questionId: string; value: unknown } }>
  >([]);
  const sessionReadyRef = useRef(false);

  // ── Generic analytics event (analytics_events table, anon_id based) ──────

  const trackEvent = useCallback(
    async (eventType: string, payload: any = {}) => {
      try {
        const anonId =
          typeof window !== "undefined"
            ? sessionStorage.getItem("anon_id") || ""
            : "";
        if (!anonId) return;

        await (supabase as any).from("analytics_events").insert({
          anon_id: anonId,
          event_type: eventType,
          payload,
          location_id: payload.location_id || null,
        });
      } catch (e) {
        console.error("Failed to track event", e);
      }
    },
    [],
  );

  // ── Flush queued node/answer updates after session is ready ──────────────

  const flushPendingUpdates = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId || pendingUpdatesRef.current.length === 0) return;

    for (const update of pendingUpdatesRef.current) {
      if (
        visitedNodesRef.current[visitedNodesRef.current.length - 1] !==
        update.nodeId
      ) {
        visitedNodesRef.current = [...visitedNodesRef.current, update.nodeId];
      }
      if (update.answer) {
        partialAnswersRef.current = {
          ...partialAnswersRef.current,
          [update.answer.questionId]: update.answer.value,
        };
      }
    }
    pendingUpdatesRef.current = [];

    try {
      await supabase
        .from("flow_sessions")
        .update({
          current_node_id:
            visitedNodesRef.current[visitedNodesRef.current.length - 1] || null,
          visited_nodes:   visitedNodesRef.current as unknown as null,
          partial_answers: partialAnswersRef.current as unknown as null,
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    } catch (error) {
      console.error("Error flushing pending updates:", error);
    }
  }, []);

  // ── Track QR scan / page visit ────────────────────────────────────────────
  // Detects return visitors by checking if visitor_id is already in localStorage
  // (i.e., has scanned before — any form, not just this one).

  const trackVisit = useCallback(
    async (zoneId?: string) => {
      if (!formId) return;

      // A visitor_id already stored = they've visited before (any flow).
      // We set is_return_visitor based on this heuristic.
      const preExistingId = localStorage.getItem(VISITOR_ID_KEY);
      const isReturnVisitor = !!preExistingId;

      try {
        await supabase.from("form_visits").insert({
          form_id:           formId,
          visitor_id:        visitorIdRef.current,
          referrer:          document.referrer || null,
          user_agent:        navigator.userAgent || null,
          zone_id:           zoneId || null,
          is_return_visitor: isReturnVisitor,
        });
      } catch (error) {
        console.error("Error tracking visit:", error);
      }
    },
    [formId],
  );

  // ── Start a new flow session ──────────────────────────────────────────────

  const startSession = useCallback(
    async (
      initialNodeId?: string,
      opts?: { flowVersion?: string },
    ): Promise<string | null> => {
      if (!formId) return null;

      try {
        const sessionId = uuidv4();
        sessionStartRef.current = Date.now(); // record wall-clock start time

        // Persist start time so it survives hook re-renders or garbage collection
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(
            `mirour_session_start_${sessionId}`,
            String(sessionStartRef.current),
          );
        }

        const { error } = await supabase.from("flow_sessions").insert({
          id:             sessionId,
          form_id:        formId,
          visitor_id:     visitorIdRef.current,
          current_node_id: initialNodeId || null,
          visited_nodes:  initialNodeId ? [initialNodeId] : [],
          partial_answers: {},
          status:         "in_progress",
          flow_version:   opts?.flowVersion || "v1",
          device_type:    getDeviceType(),
          os:             getOS(),
          browser:        getBrowser(),
        });

        // Trigger an async location fetch
        fetch("https://ipapi.co/json/")
          .then((res) => res.json())
          .then((data) => {
            if (data && data.city) {
              supabase
                .from("flow_sessions")
                .update({
                  city: data.city,
                  region: data.region,
                  country: data.country_name,
                })
                .eq("id", sessionId)
                .then();
            }
          })
          .catch((err) => console.log("Location fetch skipped or failed", err));

        if (error) throw error;

        visitedNodesRef.current   = initialNodeId ? [initialNodeId] : [];
        partialAnswersRef.current = {};
        sessionIdRef.current      = sessionId;
        sessionReadyRef.current   = true;
        nodeStartRef.current      = Date.now();

        await flushPendingUpdates();
        await trackEvent("quiz_start", { form_id: formId, initialNodeId });

        return sessionId;
      } catch (error) {
        console.error("Error starting session:", error);
        return null;
      }
    },
    [formId, flushPendingUpdates, trackEvent],
  );

  // ── Record a visitor journey row (cross-location tracking) ───────────────
  // Call this once per session, right after startSession returns a sessionId.

  const recordJourney = useCallback(
    async (sessionId: string, storeId: string, customerId?: string) => {
      try {
        const { data: existing } = await (supabase as any)
          .from("visitor_location_journeys")
          .select("id")
          .eq("visitor_id", visitorIdRef.current)
          .eq("session_id", sessionId)
          .maybeSingle();

        if (!existing) {
          await (supabase as any)
            .from("visitor_location_journeys")
            .insert({
              visitor_id:  visitorIdRef.current,
              customer_id: customerId || null,
              store_id:    storeId,
              session_id:  sessionId,
            });
        }
      } catch (error) {
        console.error("Error recording journey:", error);
      }
    },
    [],
  );

  // ── Update progress (node visit + optional answer) ────────────────────────

  const updateProgress = useCallback(
    async (
      nodeId: string,
      answer?: { questionId: string; value: unknown },
    ) => {
      if (!sessionReadyRef.current || !sessionIdRef.current) {
        pendingUpdatesRef.current.push({ nodeId, answer });
        return;
      }

      const sessionId = sessionIdRef.current;
      const prevNodeId = visitedNodesRef.current[visitedNodesRef.current.length - 1];

      try {
        let timeInPrevNode = 0;
        let enteredAtIso = undefined;
        if (nodeStartRef.current) {
          timeInPrevNode = Math.round((Date.now() - nodeStartRef.current) / 1000);
          enteredAtIso = new Date(nodeStartRef.current).toISOString();
        }

        if (prevNodeId && prevNodeId !== nodeId) {
          // Fire and forget insert for the previous node
          (supabase as any).from("flow_session_nodes").insert({
            session_id:         sessionId,
            form_id:            formId,
            node_id:            prevNodeId,
            time_spent_seconds: timeInPrevNode,
            entered_at:         enteredAtIso,
            exited_at:          new Date().toISOString(),
            is_dropoff:         false,
          }).then();
        }

        // Only update start time if it's genuinely a new node
        if (prevNodeId !== nodeId) {
          nodeStartRef.current = Date.now();
        }
        if (
          visitedNodesRef.current[visitedNodesRef.current.length - 1] !== nodeId
        ) {
          visitedNodesRef.current = [...visitedNodesRef.current, nodeId];
        }

        if (answer) {
          partialAnswersRef.current = {
            ...partialAnswersRef.current,
            [answer.questionId]: answer.value,
          };
        }

        await supabase
          .from("flow_sessions")
          .update({
            current_node_id: nodeId,
            visited_nodes:   visitedNodesRef.current as unknown as null,
            partial_answers: partialAnswersRef.current as unknown as null,
            last_activity_at: new Date().toISOString(),
          })
          .eq("id", sessionId);

        if (answer) {
          await trackEvent(`${answer.questionId.toLowerCase()}_answer`, {
            value: answer.value,
          });
        }
      } catch (error) {
        console.error("Error updating progress:", error);
      }
    },
    [trackEvent],
  );

  // ── Complete session ──────────────────────────────────────────────────────

const completeSession = useCallback(
  async (responseId: string, customerId?: string) => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const lastNodeId =
      visitedNodesRef.current[visitedNodesRef.current.length - 1];
    const nodeTimeSec = nodeStartRef.current
      ? Math.round((Date.now() - nodeStartRef.current) / 1000)
      : null;
    const enteredAt = nodeStartRef.current
      ? new Date(nodeStartRef.current).toISOString()
      : null;

    const storedStart =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(`mirour_session_start_${sessionId}`)
        : null;
    const startTime =
      sessionStartRef.current ??
      (storedStart ? parseInt(storedStart, 10) : null);
    const totalTimeSec =
      startTime != null ? Math.round((Date.now() - startTime) / 1000) : null;

    if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(`mirour_session_start_${sessionId}`);
    }

    try {
      const res = await fetch("/api/sessions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          responseId,
          customerId: customerId ?? null,
          totalTimeSec,
          lastNodeId: lastNodeId || null,
          nodeTimeSec,
          enteredAt,
        }),
      });

      const json = await res.json();
      if (!json.ok) console.error("completeSession failed:", json.error);
      else console.log("SESSION COMPLETED via API ✅");
    } catch (err) {
      console.error("completeSession fetch error:", err);
    }
  },
  [formId],
);


  // ── Abandon session — records the drop-off node + time ──────────────────
  // SYNC (no async) — called from beforeunload / visibilitychange.
  // Uses sendBeacon so the request is guaranteed to complete even as the page
  // is torn down. Async fetch is silently dropped by browsers on page close.

  const markAbandoned = useCallback(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const dropOffNode =
      visitedNodesRef.current[visitedNodesRef.current.length - 1] || null;

    // Compute total time with the same fallback logic as completeSession
    const storedStart =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(`mirour_session_start_${sessionId}`)
        : null;
    const startTime =
      sessionStartRef.current ?? (storedStart ? parseInt(storedStart, 10) : null);
    const totalTimeSec =
      startTime != null
        ? Math.round((Date.now() - startTime) / 1000)
        : null;

    const payload = JSON.stringify({ sessionId, dropOffNode, totalTimeSec });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      // sendBeacon: fire-and-forget, browser guarantees delivery on page close
      navigator.sendBeacon("/api/sessions/abandon", payload);
    } else {
      // keepalive fetch as fallback (e.g. Node.js test environments)
      fetch("/api/sessions/abandon", {
        method:   "POST",
        body:     payload,
        keepalive: true,
      }).catch(() => {});
    }
  }, []);
const trackQrScan = useCallback(
  async (storeId: string, customerId?: string, zoneId?: string) => {
    if (!formId || !storeId) return;
    const sessionId = sessionIdRef.current;

    try {
      // 1. Insert qr_scan into interactions
      await (supabase as any).from("interactions").insert({
        store_id: storeId,
        session_id: sessionId || null,
        customer_id: customerId || null,
        event_type: "qr_scan",
        metadata: {
          form_id: formId,
          zone_id: zoneId || null,
          scanned_at: new Date().toISOString(),
        },
      });

      // 2. Increment visit_count on customers table
      if (customerId) {
        await (supabase as any).rpc("increment_customer_visit_count", {
          p_customer_id: customerId,
        });
      }
    } catch (error) {
      console.error("Error tracking QR scan:", error);
    }
  },
  [formId],
);

  // ── Track a link click ────────────────────────────────────────────────────
  // event_type = 'link_clicked', metadata = { url, title, clicked_at }

  const trackLinkClick = useCallback(
    async (
      storeId: string,
      linkUrl: string,
      linkTitle: string,
      customerId?: string,
    ) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId || !storeId) return;

      try {
        await (supabase as any).from("interactions").insert({
          store_id:    storeId,
          session_id:  sessionId,
          customer_id: customerId || null,
          event_type:  "link_clicked",
          metadata: {
            url:        linkUrl,
            title:      linkTitle,
            clicked_at: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Error tracking link click:", error);
      }
    },
    [],
  );

  return {
    visitorId: visitorIdRef.current,
    sessionId: sessionIdRef.current,
    trackVisit,
    trackQrScan,
    startSession,
    recordJourney,
    updateProgress,
    completeSession,
    markAbandoned,
    trackEvent,
    trackLinkClick,
    getDeviceType,
  };
};
