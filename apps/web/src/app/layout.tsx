import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "../components/app-shell";
import { QueryProvider } from "../components/query-provider";

export const metadata: Metadata = {
  title: "HookLens",
  description: "Webhook delivery operations console",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
