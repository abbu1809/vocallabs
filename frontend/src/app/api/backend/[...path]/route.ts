import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const HASURA_URL =
  process.env.NEXT_PUBLIC_HASURA_HTTP_URL || "http://localhost:8080/v1/graphql";
const HASURA_ADMIN_SECRET =
  process.env.HASURA_ADMIN_SECRET ||
  process.env.HASURA_GRAPHQL_ADMIN_SECRET ||
  "nhost-admin-secret";
const JWT_SECRET =
  process.env.JWT_SECRET ||
  "0123456789012345678901234567890123456789012345678901234567891234";
const TARGET_FUNCTIONS_URL =
  process.env.NEXT_PUBLIC_FUNCTIONS_URL || "http://localhost:3001";

async function executeHasuraGraphQL(query: string, variables: any = {}) {
  const res = await fetch(HASURA_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
    },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors) {
    throw new Error(data.errors[0]?.message || "Hasura GraphQL error");
  }
  return data.data;
}

function generateToken(user: { id: string; email: string; display_name?: string }) {
  return jwt.sign(
    {
      "https://hasura.io/jwt/claims": {
        "x-hasura-allowed-roles": ["user", "anonymous"],
        "x-hasura-default-role": "user",
        "x-hasura-user-id": user.id,
      },
      sub: user.id,
      email: user.email,
      display_name: user.display_name,
    },
    JWT_SECRET,
    { algorithm: "HS256", expiresIn: "7d" }
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const subpath = path.join("/");
    const body = await req.json().catch(() => ({}));

    // ── 1. Create Organization Handler ──────────────────────────────
    if (subpath.endsWith("create-organization")) {
      const payload = body.input || body;
      const { name, user_id } = payload;

      if (!name || !user_id) {
        return NextResponse.json(
          { message: "name and user_id are required" },
          { status: 400 }
        );
      }

      const orgId = uuidv4();
      const mutation = `
        mutation CreateUserOrg($org_id: uuid!, $name: String!, $user_id: uuid!) {
          insert_organizations_one(object: {
            id: $org_id,
            name: $name,
            quota_limit: 100,
            quota_used: 0
          }) {
            id
            name
          }
          insert_org_members_one(object: {
            org_id: $org_id,
            user_id: $user_id,
            role: "owner"
          }) {
            id
          }
        }
      `;

      await executeHasuraGraphQL(mutation, {
        org_id: orgId,
        name,
        user_id,
      });

      return NextResponse.json(
        {
          org_id: orgId,
          name,
          message: "Organization created successfully",
        },
        { status: 200 }
      );
    }

    // ── 2. Login User Handler ───────────────────────────────────────
    if (subpath.endsWith("login-user")) {
      const payload = body.input || body;
      const { email, password } = payload;

      if (!email || !password) {
        return NextResponse.json(
          { message: "email and password are required" },
          { status: 400 }
        );
      }

      const getUserQuery = `
        query GetUser($email: String!) {
          users(where: { email: { _eq: $email } }) {
            id
            email
            password_hash
            display_name
            org_members {
              org_id
              role
            }
          }
        }
      `;

      const data = await executeHasuraGraphQL(getUserQuery, { email });
      const user = data.users?.[0];

      if (!user) {
        return NextResponse.json(
          { message: "Invalid email or password" },
          { status: 401 }
        );
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return NextResponse.json(
          { message: "Invalid email or password" },
          { status: 401 }
        );
      }

      // If user has 0 workspaces, auto-provision default workspace
      if (!user.org_members || user.org_members.length === 0) {
        const orgId = uuidv4();
        const createOrgMutation = `
          mutation AutoCreateOrg($org_id: uuid!, $name: String!, $user_id: uuid!) {
            insert_organizations_one(object: {
              id: $org_id,
              name: $name,
              quota_limit: 100,
              quota_used: 0
            }) {
              id
            }
            insert_org_members_one(object: {
              org_id: $org_id,
              user_id: $user_id,
              role: "owner"
            }) {
              id
            }
          }
        `;
        await executeHasuraGraphQL(createOrgMutation, {
          org_id: orgId,
          name: `${user.display_name || user.email.split("@")[0]}'s Workspace`,
          user_id: user.id,
        });
      }

      const token = generateToken(user);
      return NextResponse.json(
        {
          user_id: user.id,
          token,
          message: "Login successful",
        },
        { status: 200 }
      );
    }

    // ── 3. Register User Handler ────────────────────────────────────
    if (subpath.endsWith("register-user")) {
      const payload = body.input || body;
      const { email, password, display_name } = payload;

      if (!email || !password || !display_name) {
        return NextResponse.json(
          { message: "email, password, and display_name are required" },
          { status: 400 }
        );
      }

      const checkQuery = `
        query CheckUser($email: String!) {
          users(where: { email: { _eq: $email } }) {
            id
          }
        }
      `;
      const existing = await executeHasuraGraphQL(checkQuery, { email });
      if (existing.users && existing.users.length > 0) {
        return NextResponse.json(
          { message: "A user with this email already exists" },
          { status: 409 }
        );
      }

      const userId = uuidv4();
      const orgId = uuidv4();
      const passwordHash = await bcrypt.hash(password, 10);

      const registerMutation = `
        mutation RegisterUser($user_id: uuid!, $email: String!, $password_hash: String!, $display_name: String!, $org_id: uuid!, $org_name: String!) {
          insert_users_one(object: {
            id: $user_id,
            email: $email,
            password_hash: $password_hash,
            display_name: $display_name
          }) {
            id
            email
            display_name
          }
          insert_organizations_one(object: {
            id: $org_id,
            name: $org_name,
            quota_limit: 100,
            quota_used: 0
          }) {
            id
          }
          insert_org_members_one(object: {
            org_id: $org_id,
            user_id: $user_id,
            role: "owner"
          }) {
            id
          }
        }
      `;

      await executeHasuraGraphQL(registerMutation, {
        user_id: userId,
        email,
        password_hash: passwordHash,
        display_name,
        org_id: orgId,
        org_name: `${display_name}'s Workspace`,
      });

      const token = generateToken({
        id: userId,
        email,
        display_name,
      });

      return NextResponse.json(
        {
          user_id: userId,
          token,
          message: "Registration successful",
        },
        { status: 200 }
      );
    }

    // ── 4. Fallback Proxy to Functions Engine ────────────────────────
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
      { message: err.message || "Failed to process request" },
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
      { message: err.message || "Failed to process request" },
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
