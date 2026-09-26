import * as Y from "yjs";

/**
 * Syncs a Yjs document between tabs of the same browser over BroadcastChannel.
 *
 * Stand-in for `SupabaseProvider` from `@supabase-labs/y-supabase`: same doc,
 * same update flow, but nothing leaves the device — no Supabase key in the
 * bundle and no public read/write surface. Swap it for SupabaseProvider once
 * rooms can be authorized per user.
 */

type Message =
  | { type: "update"; update: Uint8Array }
  | { type: "sync-request"; stateVector: Uint8Array }
  | { type: "sync-reply"; update: Uint8Array };

type Listener = () => void;

export class BroadcastProvider {
  private channel: BroadcastChannel | null;
  private listeners = new Set<Listener>();

  constructor(
    room: string,
    private doc: Y.Doc,
  ) {
    this.channel =
      typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(`musaix-flow:${room}`);
    if (!this.channel) return;

    this.channel.onmessage = (event: MessageEvent<Message>) => this.handle(event.data);
    this.doc.on("update", this.onDocUpdate);
    // Ask any open tab for what we're missing.
    this.post({ type: "sync-request", stateVector: Y.encodeStateVector(doc) });
  }

  /** Called whenever another tab sends us document state. */
  onRemote(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy() {
    this.doc.off("update", this.onDocUpdate);
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this) this.post({ type: "update", update });
  };

  private handle(message: Message) {
    switch (message.type) {
      case "sync-request":
        this.post({
          type: "sync-reply",
          update: Y.encodeStateAsUpdate(this.doc, message.stateVector),
        });
        return;
      case "update":
      case "sync-reply":
        Y.applyUpdate(this.doc, message.update, this);
        this.listeners.forEach((listener) => listener());
        return;
    }
  }

  private post(message: Message) {
    this.channel?.postMessage(message);
  }
}
