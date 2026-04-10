import { NextResponse } from "next/server";
import { Nango } from "@nangohq/node";

const nango = new Nango({ secretKey: process.env.NANGO_SECRET_KEY! });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { connectionId } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { error: "Missing connectionId" },
        { status: 400 },
      );
    }

    const session = await nango.createConnectSession({
      end_user: { id: connectionId },
      // ✅ No allowed_integrations — works for any integration in your dashboard
    });

    return NextResponse.json({ connectSessionToken: session.data.token });
  } catch (err: any) {
    console.error(
      "[Nango Session] Full error:",
      JSON.stringify(err?.response?.data, null, 2),
    );
    return NextResponse.json(
      { error: err?.response?.data?.error || err.message },
      { status: 500 },
    );
  }
}
