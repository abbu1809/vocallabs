"use client";

import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client';
import { ApolloProvider as BaseApolloProvider } from '@apollo/client/react';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { setContext } from '@apollo/client/link/context';
import React, { useMemo } from 'react';
import { useAuth } from './auth-context';

const HASURA_HTTP = process.env.NEXT_PUBLIC_HASURA_HTTP_URL || 'http://localhost:8080/v1/graphql';
const HASURA_WS = process.env.NEXT_PUBLIC_HASURA_WS_URL || 'ws://localhost:8080/v1/graphql';

function createApolloClient(token: string | null) {
  const httpLink = new HttpLink({ uri: HASURA_HTTP });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  const wsLink = typeof window !== 'undefined'
    ? new GraphQLWsLink(
        createClient({
          url: HASURA_WS,
          connectionParams: () => ({
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        })
      )
    : null;

  const splitLink = wsLink
    ? split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        authLink.concat(httpLink)
      )
    : authLink.concat(httpLink);

  return new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: { fetchPolicy: 'cache-and-network' },
    },
  });
}

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  const client = useMemo(() => createApolloClient(token), [token]);

  return (
    <BaseApolloProvider client={client}>
      {children}
    </BaseApolloProvider>
  );
}
