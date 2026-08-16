"use client";

import { AuthProvider } from "@/lib/auth-context";
import { ApolloProvider } from "@/lib/apollo-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ApolloProvider>
        {children}
      </ApolloProvider>
    </AuthProvider>
  );
}
