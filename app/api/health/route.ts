import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json({
    status: "ok",
    application: "MarketingGen AI",
    storage: process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "browser-demo",
    ai: process.env.OPENAI_API_KEY ? "configured" : "demo-templates",
    delivery: "not-configured",
  });
}
