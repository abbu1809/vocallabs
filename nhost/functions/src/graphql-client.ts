import { GraphQLClient } from 'graphql-request';

const HASURA_URL = process.env.HASURA_GRAPHQL_URL || 'http://graphql-engine:8080/v1/graphql';
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET || 'nhost-admin-secret';

/**
 * Admin client — bypasses all Hasura permissions.
 * Used by action handlers for internal DB operations.
 */
export const adminClient = new GraphQLClient(HASURA_URL, {
  headers: {
    'x-hasura-admin-secret': ADMIN_SECRET,
  },
});

/**
 * Creates a client scoped to a specific user (for permission checks via Hasura).
 */
export function userClient(userId: string): GraphQLClient {
  return new GraphQLClient(HASURA_URL, {
    headers: {
      'x-hasura-admin-secret': ADMIN_SECRET,
      'x-hasura-role': 'user',
      'x-hasura-user-id': userId,
    },
  });
}
