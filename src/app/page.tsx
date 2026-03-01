"use client";

import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME } from "@/lib/utils";

export default function Home() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary px-6">
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-bold text-primary-foreground tracking-tight sm:text-5xl">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-lg text-primary-foreground/70">
          Your starter template with Convex and Next.js
        </p>

        <Unauthenticated>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signin"
              className="w-full sm:w-auto rounded-md bg-white px-6 py-3 text-primary font-medium hover:bg-white/90 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-md border border-primary-foreground/30 px-6 py-3 text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </Unauthenticated>

        <Authenticated>
          <div className="mt-10">
            <Link
              href="/dashboard"
              className="rounded-md bg-white px-8 py-3 text-primary font-medium hover:bg-white/90 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </Authenticated>
      </div>
    </div>
  );
}
