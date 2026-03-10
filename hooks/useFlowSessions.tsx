import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DashboardSession, DashboardResponse } from '@/types/dashboard';

const ABANDON_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

interface RawSession {
  id: string;
  form_id: string;
  visitor_id: string;
  visited_nodes: unknown;
  partial_answers: unknown;
  current_node_id: string | null;
  status: string;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  response_id: string | null;
}

function computeStatus(session: RawSession): 'completed' | 'in_progress' | 'abandoned' {
  if (session.status === 'completed') return 'completed';
  
  const lastActivity = new Date(session.last_activity_at).getTime();
  const now = Date.now();
  
  if (now - lastActivity > ABANDON_THRESHOLD_MS) {
    return 'abandoned';
  }
  return 'in_progress';
}

function rawToSession(raw: RawSession, response?: DashboardResponse): DashboardSession {
  return {
    id: raw.id,
    formId: raw.form_id,
    visitorId: raw.visitor_id,
    visitedNodes: Array.isArray(raw.visited_nodes) ? raw.visited_nodes as string[] : [],
    partialAnswers: (raw.partial_answers as Record<string, any>) || {},
    currentNodeId: raw.current_node_id,
    status: computeStatus(raw),
    startedAt: new Date(raw.started_at),
    lastActivityAt: new Date(raw.last_activity_at),
    responseId: raw.response_id,
    response,
  };
}

export function useFlowSessions(formId: string) {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!formId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch sessions for this form
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('flow_sessions')
        .select('*')
        .eq('form_id', formId)
        .order('started_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Fetch responses for this form to link with completed sessions
      const { data: responsesData, error: responsesError } = await supabase
        .from('responses')
        .select('*')
        .eq('form_id', formId);

      if (responsesError) throw responsesError;

      // Create a map of response_id -> response for quick lookup
      const responseMap = new Map<string, DashboardResponse>();
      (responsesData || []).forEach((r) => {
        const dashResponse: DashboardResponse = {
          id: r.id,
          formId: r.form_id,
          customerName: r.customer_name ?? undefined,
          customerEmail: r.customer_email ?? undefined,
          customerPhone: r.customer_phone ?? undefined,
          answers: (r.answers as Record<string, any>) || {},
          redemptionCode: r.redemption_code,
          perkRedeemed: r.perk_redeemed,
          additionalFeedback: r.additional_feedback ?? undefined,
          submittedAt: new Date(r.submitted_at),
        };
        responseMap.set(r.id, dashResponse);
      });

      // Convert raw sessions to DashboardSession with linked responses
      const dashboardSessions = (sessionsData || []).map((raw) => {
        const linkedResponse = raw.response_id ? responseMap.get(raw.response_id) : undefined;
        return rawToSession(raw as RawSession, linkedResponse);
      });

      setSessions(dashboardSessions);
    } catch (err) {
      console.error('Error fetching flow sessions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch sessions'));
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { sessions, loading, error, refetch: fetchSessions };
}
