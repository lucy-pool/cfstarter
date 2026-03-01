import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider, ThemeProvider } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// TODO: Change "My App" to your app name (see APP_NAME in src/lib/utils.ts)
export const metadata: Metadata = {
  title: "My App",
  description: "Built with Convex and Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <ConvexClientProvider>
        <html lang="en" suppressHydrationWarning>
          <body>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </body>
        </html>
      </ConvexClientProvider>
    </ConvexAuthNextjsServerProvider>
  );
}
