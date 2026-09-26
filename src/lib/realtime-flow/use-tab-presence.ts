import { useEffect, useState } from "react";

/**
 * Who else has this room open — local stand-in for Supabase Realtime Presence.
 * Tabs of the same browser announce themselves over BroadcastChannel with a
 * heartbeat; a peer that stops beating (crashed tab, closed laptop) drops out.
 */

export type Peer = { id: string; name: string; image: string | null };

type Message = { type: "here"; peer: Peer } | { type: "bye"; id: string };

const HEARTBEAT_MS = 2_000;
const EXPIRE_MS = 6_000;

export function useTabPresence(room: string, self: Omit<Peer, "id">): Peer[] {
  const [peers, setPeers] = useState<Peer[]>([]);
  const { name, image } = self;

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const me: Peer = { id: crypto.randomUUID(), name, image };
    const seen = new Map<string, { peer: Peer; at: number }>();
    const channel = new BroadcastChannel(`musaix-presence:${room}`);

    const publish = () => setPeers([me, ...Array.from(seen.values(), (entry) => entry.peer)]);
    const announce = () => channel.postMessage({ type: "here", peer: me } satisfies Message);

    channel.onmessage = (event: MessageEvent<Message>) => {
      const message = event.data;
      if (message.type === "bye") {
        seen.delete(message.id);
      } else {
        // Answer a newcomer right away so it doesn't wait for our next beat.
        if (!seen.has(message.peer.id)) announce();
        seen.set(message.peer.id, { peer: message.peer, at: Date.now() });
      }
      publish();
    };

    const heartbeat = setInterval(() => {
      announce();
      const cutoff = Date.now() - EXPIRE_MS;
      for (const [id, entry] of seen) if (entry.at < cutoff) seen.delete(id);
      publish();
    }, HEARTBEAT_MS);

    const leave = () => channel.postMessage({ type: "bye", id: me.id } satisfies Message);
    window.addEventListener("pagehide", leave);

    announce();
    publish();

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("pagehide", leave);
      leave();
      channel.close();
    };
  }, [room, name, image]);

  return peers;
}
