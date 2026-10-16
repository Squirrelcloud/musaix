import { NextResponse } from "next/server";
import { authConfigured, supabaseServer } from "@/lib/auth.server";

export async function POST(request: Request) {
  if (authConfigured()) await (await supabaseServer()).auth.signOut();
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
