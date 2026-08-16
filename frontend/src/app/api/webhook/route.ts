import { NextRequest, NextResponse } from "next/server";

const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FUNCTIONS_URL || "http://localhost:3001";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflow_id, secret, payload } = body;

    if (!workflow_id || !secret) {
      return NextResponse.json(
        { error: "workflow_id and secret are required in the request body" },
        { status: 400 }
      );
    }

    const res = await fetch(`${FUNCTIONS_URL}/api/webhook-trigger`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          workflow_id,
          secret,
          payload: payload || {},
        },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
