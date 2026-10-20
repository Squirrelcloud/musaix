import { MarkerType, type Edge, type Node } from "@xyflow/react";

/**
 * The Musaix lyric agent pipeline, mapped to the Supabase tables in
 * supabase/migrations/20260926090000_musaix_lyric_intelligence_core.sql.
 */

export type StageData = {
  title: string;
  /** Table or view the stage reads/writes. */
  table: string;
  detail?: string;
  tone?: "default" | "gate" | "store";
};

export type StageNode = Node<StageData, "stage">;

const stage = (id: string, x: number, y: number, data: StageData): StageNode => ({
  id,
  type: "stage",
  position: { x, y },
  data,
});

export const PIPELINE_NODES: StageNode[] = [
  stage("prompt", 0, 0, {
    title: "Prompt",
    table: "prompt_library",
    detail: "Versioned per agent",
  }),
  stage("router", 280, 0, {
    title: "Model router",
    table: "model_outputs",
    detail: "OpenAI · Grok · Local",
  }),
  stage("draft", 560, 0, {
    title: "Draft verse",
    table: "lyric_versions",
    detail: "Content-hashed for exact repeats",
  }),
  stage("audit", 840, 0, {
    title: "Lyric audit",
    table: "lyric_audits",
    detail: "Lexical ≥ 90 · Multis ≥ 75 · Originality ≥ 88",
    tone: "gate",
  }),
  stage("revise", 700, 200, {
    title: "Targeted revision",
    table: "lyric_revisions",
    detail: "Rewrite only the flagged lines",
  }),
  stage("approved", 1120, 0, {
    title: "Approved",
    table: "lyrics.status",
    detail: "Locked to the vault",
    tone: "store",
  }),
  stage("publish", 1120, 200, {
    title: "Publish",
    table: "performance_snapshots",
    detail: "YouTube · Spotify · BeatStars",
  }),
  stage("rankings", 280, 360, {
    title: "Model rankings",
    table: "model_rankings",
    detail: "Pass rate and originality by model",
    tone: "store",
  }),
];

const edge = (
  source: string,
  target: string,
  sourceHandle: "l" | "r" | "t" | "b",
  targetHandle: "l" | "r" | "t" | "b",
  label?: string,
  animated = false,
): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  sourceHandle,
  targetHandle,
  label,
  animated,
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed },
});

export const PIPELINE_EDGES: Edge[] = [
  edge("prompt", "router", "r", "l"),
  edge("router", "draft", "r", "l"),
  edge("draft", "audit", "r", "l"),
  edge("audit", "approved", "r", "l", "pass"),
  edge("audit", "revise", "b", "r", "fail", true),
  edge("revise", "draft", "l", "b", "new version", true),
  edge("approved", "publish", "b", "t"),
  edge("publish", "rankings", "b", "r", "performance"),
  edge("audit", "rankings", "b", "t", "scores"),
  edge("rankings", "router", "l", "b", "routing weights"),
];
