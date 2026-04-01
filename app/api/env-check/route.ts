export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    hasOpenAiKey: !!process.env.OPENAI_API_KEY,
    vercelUrl: process.env.VERCEL_URL || null,
  });
}