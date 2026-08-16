/**
 * Auth Handlers — Register and Login
 *
 * Since we're running standalone (not nhost cloud auth),
 * we implement simple JWT-based auth with bcrypt passwords.
 * The JWT includes x-hasura-* claims for Hasura permissions.
 */

import { Request, Response } from 'express';
import { adminClient } from '../graphql-client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { gql } from 'graphql-request';

const JWT_SECRET = process.env.JWT_SECRET || '0123456789012345678901234567890123456789012345678901234567891234';

// We store users in a custom table since we're not using nhost auth service
const ENSURE_USERS_TABLE = gql`
  mutation EnsureUsersTable {
    __typename
  }
`;

const CREATE_USER = gql`
  mutation CreateUser($id: uuid!, $email: String!, $password_hash: String!, $display_name: String!) {
    insert_users_one(object: {
      id: $id,
      email: $email,
      password_hash: $password_hash,
      display_name: $display_name
    }) {
      id
      email
      display_name
    }
  }
`;

const CREATE_USER_ORG = gql`
  mutation CreateUserOrg($org_id: uuid!, $name: String!, $user_id: uuid!) {
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

const GET_USER_BY_EMAIL = gql`
  query GetUserByEmail($email: String!) {
    users(where: { email: { _eq: $email } }) {
      id
      email
      password_hash
      display_name
    }
  }
`;

const GET_USER_ORGS = gql`
  query GetUserOrgs($user_id: uuid!) {
    org_members(where: { user_id: { _eq: $user_id } }) {
      org_id
      role
      organization {
        id
        name
      }
    }
  }
`;

function generateToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      'https://hasura.io/jwt/claims': {
        'x-hasura-user-id': userId,
        'x-hasura-default-role': 'user',
        'x-hasura-allowed-roles': ['user'],
      },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
}

export async function registerUser(req: Request, res: Response) {
  try {
    const payload = req.body;
    const { email, password, display_name } = payload.input || payload;

    if (!email || !password || !display_name) {
      return res.status(400).json({ message: 'email, password, and display_name are required' });
    }

    // Check if user exists
    const existing: any = await adminClient.request(GET_USER_BY_EMAIL, { email });
    if (existing.users.length > 0) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Create user
    await adminClient.request(CREATE_USER, {
      id: userId,
      email,
      password_hash: passwordHash,
      display_name,
    });

    // Create default personal organization for user
    const orgId = uuidv4();
    await adminClient.request(CREATE_USER_ORG, {
      org_id: orgId,
      name: `${display_name}'s Workspace`,
      user_id: userId,
    });

    // Generate JWT
    const token = generateToken(userId);

    return res.status(200).json({
      user_id: userId,
      token,
      message: 'User registered successfully',
    });
  } catch (err: any) {
    console.error('[registerUser] Error:', err);
    return res.status(500).json({ message: err.message || 'Registration failed' });
  }
}

export async function loginUser(req: Request, res: Response) {
  try {
    const payload = req.body;
    const { email, password } = payload.input || payload;

    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    // Find user
    const data: any = await adminClient.request(GET_USER_BY_EMAIL, { email });
    const user = data.users[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = generateToken(user.id);

    // Get user's orgs
    const orgData: any = await adminClient.request(GET_USER_ORGS, { user_id: user.id });

    // If user has no workspace, auto-create one
    if (!orgData.org_members || orgData.org_members.length === 0) {
      const orgId = uuidv4();
      await adminClient.request(CREATE_USER_ORG, {
        org_id: orgId,
        name: `${user.display_name || user.email.split('@')[0]}'s Workspace`,
        user_id: user.id,
      });
    }

    return res.status(200).json({
      user_id: user.id,
      token,
      message: 'Login successful',
    });
  } catch (err: any) {
    console.error('[loginUser] Error:', err);
    return res.status(500).json({ message: err.message || 'Login failed' });
  }
}

export async function createOrganization(req: Request, res: Response) {
  try {
    const payload = req.body;
    const { name, user_id } = payload.input || payload;

    if (!name || !user_id) {
      return res.status(400).json({ message: 'name and user_id are required' });
    }

    const orgId = uuidv4();
    await adminClient.request(CREATE_USER_ORG, {
      org_id: orgId,
      name,
      user_id,
    });

    return res.status(200).json({
      org_id: orgId,
      name,
      message: 'Organization created successfully',
    });
  } catch (err: any) {
    console.error('[createOrganization] Error:', err);
    return res.status(500).json({ message: err.message || 'Failed to create organization' });
  }
}
