import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "VocalLabs — AI Agent Workflow Platform",
  description: "Chain AI agent steps, API endpoints, logic gates, and approvals in a visual discovery-first workflow studio.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#fbfbf9] text-[#33332e] antialiased selection:bg-[#e60023] selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
