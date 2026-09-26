import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { BroadcastProvider } from "./broadcast-provider";

/**
 * React Flow state bound to a Yjs document, adapted from Supabase UI's
 * `useRealtimeFlow`. Nodes and edges live in two Y.Maps keyed by id, so
 * concurrent edits merge per element. Transport is BroadcastProvider
 * (same-browser tabs) instead of Supabase Realtime; the return shape matches
 * the Supabase hook so the transport can be swapped later.
 */

type UseRealtimeFlowOptions<N extends Node> = {
  channel: string;
  initialNodes?: N[];
  initialEdges?: Edge[];
};

type SetStateAction<T> = T | ((prev: T) => T);

// How long to wait for another tab's state before seeding the defaults.
const INITIAL_SYNC_MS = 250;

export function useRealtimeFlow<N extends Node = Node>({
  channel,
  initialNodes = [],
  initialEdges = [],
}: UseRealtimeFlowOptions<N>) {
  const [nodes, setNodesState] = useState<N[]>([]);
  const [edges, setEdgesState] = useState<Edge[]>([]);
  const [synced, setSynced] = useState(false);

  const docRef = useRef<Y.Doc | null>(null);
  const syncedRef = useRef(false);
  const initialNodesRef = useRef(initialNodes);
  const initialEdgesRef = useRef(initialEdges);

  useEffect(() => {
    const doc = new Y.Doc();
    const yNodes = doc.getMap<string>("nodes");
    const yEdges = doc.getMap<string>("edges");

    const readNodes = () => setNodesState(parseMap<N>(yNodes));
    const readEdges = () => setEdgesState(parseMap<Edge>(yEdges));

    const nodesObserver = (event: Y.YMapEvent<string>) => {
      if (event.transaction.origin !== "local") readNodes();
    };
    const edgesObserver = (event: Y.YMapEvent<string>) => {
      if (event.transaction.origin !== "local") readEdges();
    };
    yNodes.observe(nodesObserver);
    yEdges.observe(edgesObserver);

    const markSynced = () => {
      if (syncedRef.current) return;
      syncedRef.current = true;
      clearTimeout(timer);
      // Seed only when no other tab supplied state. If two fresh tabs seed at
      // once they write identical values under identical keys, so they converge.
      seedMap(doc, yNodes, initialNodesRef.current);
      seedMap(doc, yEdges, initialEdgesRef.current);
      readNodes();
      readEdges();
      setSynced(true);
    };

    const provider = new BroadcastProvider(channel, doc);
    const stopListening = provider.onRemote(markSynced);
    const timer = setTimeout(markSynced, INITIAL_SYNC_MS);

    docRef.current = doc;

    return () => {
      clearTimeout(timer);
      stopListening();
      yNodes.unobserve(nodesObserver);
      yEdges.unobserve(edgesObserver);
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      syncedRef.current = false;
      setSynced(false);
    };
  }, [channel]);

  /** Mirror a full React array into its Y.Map (adds, updates, deletes). */
  const writeAll = useCallback(<T extends { id: string }>(name: string, items: T[]) => {
    const doc = docRef.current;
    if (!doc || !syncedRef.current) return;
    const map = doc.getMap<string>(name);
    doc.transact(() => {
      const ids = new Set(items.map((item) => item.id));
      for (const key of Array.from(map.keys())) if (!ids.has(key)) map.delete(key);
      for (const item of items) map.set(item.id, JSON.stringify(item));
    }, "local");
  }, []);

  const setNodes = useCallback(
    (action: SetStateAction<N[]>) =>
      setNodesState((current) => {
        const next = typeof action === "function" ? action(current) : action;
        writeAll("nodes", next);
        return next;
      }),
    [writeAll],
  );

  const setEdges = useCallback(
    (action: SetStateAction<Edge[]>) =>
      setEdgesState((current) => {
        const next = typeof action === "function" ? action(current) : action;
        writeAll("edges", next);
        return next;
      }),
    [writeAll],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<N>[]) => setNodes((current) => applyNodeChanges(changes, current)),
    [setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((current) => applyEdgeChanges(changes, current)),
    [setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => setEdges((current) => addEdge(connection, current)),
    [setEdges],
  );

  /** Replace everything with the initial diagram, in every open tab. */
  const reset = useCallback(() => {
    setNodes(initialNodesRef.current);
    setEdges(initialEdgesRef.current);
  }, [setNodes, setEdges]);

  return {
    nodes,
    edges,
    synced,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges,
    reset,
  };
}

function parseMap<T>(map: Y.Map<string>): T[] {
  const items: T[] = [];
  map.forEach((value) => {
    try {
      items.push(JSON.parse(value) as T);
    } catch {
      // Skip a malformed entry rather than break the canvas.
    }
  });
  return items;
}

function seedMap<T extends { id: string }>(doc: Y.Doc, map: Y.Map<string>, items: T[]) {
  if (map.size > 0 || items.length === 0) return;
  doc.transact(() => {
    for (const item of items) map.set(item.id, JSON.stringify(item));
  }, "local");
}
