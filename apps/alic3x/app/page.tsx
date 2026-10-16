import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth.server";
import { Alic3xConsole } from "@/components/console";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await currentUser();
  if (auth.ok) return <Alic3xConsole email={auth.email} />;
  if (auth.reason === "signed-out") redirect("/login");

  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="font-display text-section font-bold">
          Alic<span className="text-accent">3</span>X
        </h1>
        <p className="text-sm text-muted">
          {auth.reason === "not-allowed"
            ? "This account isn't on the Alic3X allow-list."
            : "Sign-in isn't configured yet. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and ALIC3X_ALLOWED_EMAILS."}
        </p>
        {auth.reason === "not-allowed" && (
          <form action="/auth/signout" method="post">
            <button className="rounded-md border border-border-strong px-4 py-2 text-sm hover:bg-bg-subtle">
              Sign out
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
