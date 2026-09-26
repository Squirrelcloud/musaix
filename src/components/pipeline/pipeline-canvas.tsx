import {
  Background,
  ConnectionMode,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeProps,
} from "@xyflow/react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { useRealtimeFlow } from "@/lib/realtime-flow/use-realtime-flow";
import { useTabPresence } from "@/lib/realtime-flow/use-tab-presence";
import { cn } from "@/lib/utils";
import { AvatarStack } from "./avatar-stack";
import { PIPELINE_EDGES, PIPELINE_NODES, type StageNode } from "./pipeline-graph";

const ROOM = "lyric-pipeline";

const HANDLES = [
  { id: "l", position: Position.Left },
  { id: "r", position: Position.Right },
  { id: "t", position: Position.Top },
  { id: "b", position: Position.Bottom },
] as const;

function StageCard({ data, selected }: NodeProps<StageNode>) {
  return (
    <div
      className={cn(
        "w-52 rounded-md bg-bg-elevated px-3.5 py-3 shadow-[var(--shadow-border)] transition-shadow",
        data.tone === "gate" && "ring-1 ring-accent",
        selected && "ring-2 ring-fg",
      )}
    >
      {/* Loose connection mode: every handle can start or end an edge. */}
      {HANDLES.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position}
          className="!size-2 !border-0 !bg-border-strong"
        />
      ))}
      <p className="text-2xs font-medium tracking-section text-subtle uppercase">
        {data.tone === "gate" ? "Gate" : data.tone === "store" ? "Store" : "Step"}
      </p>
      <p className="mt-1 font-display text-sm font-semibold text-fg">{data.title}</p>
      <p className="mt-0.5 font-mono text-2xs text-accent">{data.table}</p>
      {data.detail && <p className="mt-2 text-xs leading-snug text-muted">{data.detail}</p>}
    </div>
  );
}

const nodeTypes = { stage: StageCard };

function Canvas() {
  const { nodes, edges, synced, onNodesChange, onEdgesChange, onConnect, reset } =
    useRealtimeFlow<StageNode>({
      channel: ROOM,
      initialNodes: PIPELINE_NODES,
      initialEdges: PIPELINE_EDGES,
    });
  const user = useCurrentUser();
  const peers = useTabPresence(ROOM, {
    name: user?.displayName ?? "Guest",
    image: user?.profileImageUrl ?? null,
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <AvatarStack avatars={peers} />
          <p className="text-xs text-muted">
            {peers.length === 1 ? "Only this tab" : `${peers.length} tabs editing`} · open another
            tab to see edits sync
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={reset} disabled={!synced}>
          <RotateCcw className="size-4" aria-hidden />
          Reset diagram
        </Button>
      </div>
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={synced ? nodes : []}
          edges={synced ? edges : []}
          onNodesChange={synced ? onNodesChange : undefined}
          onEdgesChange={synced ? onEdgesChange : undefined}
          onConnect={synced ? onConnect : undefined}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          colorMode="dark"
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
        {!synced && (
          <p className="absolute inset-0 grid place-items-center text-sm text-muted">Syncing…</p>
        )}
      </div>
    </div>
  );
}

export function PipelineCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  );
}
