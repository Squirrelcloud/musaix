import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth.server";

/** Magic-link landing: exchange the code for a session cookie, then open the console. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await (await supabaseServer()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=link", url.origin));
}
