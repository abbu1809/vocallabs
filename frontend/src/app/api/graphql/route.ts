import { NextRequest, NextResponse } from "next/server";

/**
 * GraphQL Proxy — routes Apollo client requests through our server
 * so we can use the admin secret instead of JWT for Hasura auth.
 * This avoids JWT signature mismatches between our HS256 tokens
 * and Nhost Cloud's RS256 keys.
 */

const HASURA_URL =
  process.env.NEXT_PUBLIC_HASURA_HTTP_URL ||
  process.env.NHOST_GRAPHQL_URL ||
  "http://localhost:8080/v1/graphql";
const HASURA_ADMIN_SECRET =
  process.env.HASURA_ADMIN_SECRET ||
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ||
  process.env.NHOST_ADMIN_SECRET ||
  "nhost-admin-secret";

// Shared JWT secret — must match what route.ts uses to sign tokens
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "0123456789012345678901234567890123456789012345678901234567891234";

// Dynamic import for jsonwebtoken (server-side only)
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Extract and verify the user's JWT to get their Hasura claims
    const authHeader = req.headers.get("authorization");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        const userId =
          decoded.sub ||
          decoded["https://hasura.io/jwt/claims"]?.["x-hasura-user-id"];
        const role =
          decoded["https://hasura.io/jwt/claims"]?.["x-hasura-default-role"] ||
          "user";

        // Forward as Hasura session variables with admin secret
        headers["x-hasura-admin-secret"] = HASURA_ADMIN_SECRET;
        headers["x-hasura-role"] = role;
        if (userId) {
          headers["x-hasura-user-id"] = userId;
        }
      } catch {
        // Invalid token — still proxy but without user context
        headers["x-hasura-admin-secret"] = HASURA_ADMIN_SECRET;
        headers["x-hasura-role"] = "anonymous";
      }
    } else {
      // No auth — use admin secret with anonymous role
      headers["x-hasura-admin-secret"] = HASURA_ADMIN_SECRET;
      headers["x-hasura-role"] = "anonymous";
    }

    const res = await fetch(HASURA_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    console.error("[GraphQL Proxy Error]", err);
    return NextResponse.json(
      { errors: [{ message: err.message || "GraphQL proxy error" }] },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
