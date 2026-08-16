import { NextRequest, NextResponse } from "next/server";

const TARGET_FUNCTIONS_URL =
  process.env.NEXT_PUBLIC_FUNCTIONS_URL || "http://localhost:3001";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subpath = path.join("/");
    const body = await req.json().catch(() => ({}));

    // Extract headers to forward
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    const authHeader = req.headers.get("authorization");
    if (authHeader) headers["authorization"] = authHeader;

    const targetUrl = `${TARGET_FUNCTIONS_URL}/${subpath}`;

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[Backend Proxy Error]", err);
    return NextResponse.json(
      { message: err.message || "Failed to communicate with backend services" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subpath = path.join("/");

    const headers: Record<string, string> = {};
    const authHeader = req.headers.get("authorization");
    if (authHeader) headers["authorization"] = authHeader;

    const targetUrl = `${TARGET_FUNCTIONS_URL}/${subpath}`;

    const res = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[Backend Proxy Error]", err);
    return NextResponse.json(
      { message: err.message || "Failed to communicate with backend services" },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
