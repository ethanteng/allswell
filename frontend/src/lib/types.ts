/** Mirrors the API payloads from the NestJS backend. */

export type SessionStatus = 'DRAFT' | 'ANALYZING' | 'COMPLETE' | 'FAILED';
export type TurnKind = 'ANALYSIS' | 'FOLLOW_UP';

export interface FeedbackMoment {
  timestamp: string | null;
  speaker: string;
  quote: string;
}

export interface FeedbackItem {
  title: string;
  detail: string;
  moments: FeedbackMoment[];
  suggestion?: string;
}

export interface FeedbackStats {
  durationLabel: string | null;
  therapistTurns: number;
  clientTurns: number;
  therapistQuestions: number;
  therapistTalkSharePct: number | null;
}

export interface SessionFeedback {
  headline: string;
  summary: string;
  stats: FeedbackStats;
  strengths: FeedbackItem[];
  growthAreas: FeedbackItem[];
  themes: string[];
  generatedBy: 'heuristic-stub' | 'llm';
}

export interface Turn {
  id: string;
  kind: TurnKind;
  question: string | null;
  answer: string | null;
  feedback: SessionFeedback | null;
  model: string | null;
  promptVersion: number | null;
  latencyMs: number | null;
  createdAt: string;
}

/** Session as it appears in the sidebar — no transcript, no turns. */
export interface SessionSummary {
  id: string;
  title: string;
  status: SessionStatus;
  sessionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Session as returned by GET /sessions/:id. */
export interface SessionDetail extends SessionSummary {
  clientId: string;
  transcript: string;
  errorMessage: string | null;
  turns: Turn[];
  client: { id: string; name: string };
}

export interface ClientWithSessions {
  id: string;
  name: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  sessions: SessionSummary[];
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface ModelOption {
  id: string;
  label: string;
  note: string;
  recommended: boolean;
}

export interface PromptConfig {
  id: string;
  analysisPrompt: string;
  followUpPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export interface AdminConfigResponse {
  config: PromptConfig;
  models: ModelOption[];
  shippedDefaults: {
    analysisPrompt: string;
    followUpPrompt: string;
    model: string;
  };
}
