import { createFileRoute, Link } from "@tanstack/react-router";
import flowCss from "@xyflow/react/dist/style.css?url";
import { PipelineCanvas } from "@/components/pipeline/pipeline-canvas";

export const Route = createFileRoute("/pipeline")({
  head: () => ({
    meta: [
      { title: "Lyric pipeline — Musaix" },
      {
        name: "description",
        content:
          "How Musaix drafts, audits, revises and ranks AI-written lyrics — an editable, live-syncing diagram.",
      },
    ],
    links: [{ rel: "stylesheet", href: flowCss }],
  }),
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
        <div>
          <Link to="/" className="font-display text-sm font-semibold text-muted hover:text-fg">
            Musaix
          </Link>
          <h1 className="font-display text-section font-semibold">Lyric pipeline</h1>
        </div>
        <p className="hidden max-w-sm text-right text-xs text-muted sm:block">
          Every verse is audited before it ships. Failures loop back for a targeted rewrite; results
          feed the model rankings that steer routing.
        </p>
      </header>
      <main className="min-h-0 flex-1">
        <PipelineCanvas />
      </main>
    </div>
  );
}
