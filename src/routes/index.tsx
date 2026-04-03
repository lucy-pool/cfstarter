import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { APP_NAME } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Zap, Shield, Cloud, TrendingUp, ArrowRight, Mail } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { data: session } = useSession();
  const isAuthenticated = !!session;
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/dashboard" });
    }
  }, [isAuthenticated, navigate]);

  return (
    <>
      <style>{`
        @keyframes landing-float1 {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-12px) rotate(-1.5deg); }
        }
        @keyframes landing-float2 {
          0%, 100% { transform: translateY(0) rotate(2deg); }
          50% { transform: translateY(-10px) rotate(3.5deg); }
        }
        @keyframes landing-float3 {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-14px) rotate(0.5deg); }
        }
        @keyframes landing-float4 {
          0%, 100% { transform: translateY(0) rotate(1.5deg); }
          50% { transform: translateY(-11px) rotate(-1deg); }
        }
      `}</style>

      <div className="min-h-screen">
        {/* Full-bleed container */}
        <div
          className="relative min-h-screen overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #dbe8f4 0%, #efd8e6 25%, #f5f0ea 50%, #e8e4d8 100%)",
          }}
        >
          {/* Dark mode gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0 hidden dark:block"
            style={{
              background:
                "linear-gradient(180deg, #0C0C12 0%, #12101a 25%, #0C0C12 50%, #101210 100%)",
            }}
          />

          {/* ── Content ── */}
          <div className="relative z-10">
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 sm:px-10 py-5">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                {APP_NAME}
              </span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                {isAuthenticated ? (
                  <Button
                    asChild
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-5"
                  >
                    <Link to="/dashboard">Dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      asChild
                      variant="ghost"
                      className="rounded-full border border-foreground/15 bg-transparent hover:bg-foreground/5 text-foreground px-5"
                    >
                      <Link to="/signin">Sign in</Link>
                    </Button>
                    <Button
                      asChild
                      className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-5"
                    >
                      <Link to="/signup">Sign up</Link>
                    </Button>
                  </>
                )}
              </div>
            </nav>

            {/* Hero */}
            <div className="text-center pt-12 sm:pt-20 pb-44 sm:pb-56 px-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/40 dark:border-white/10 px-1 py-1 pr-4 mb-8">
                <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                  {APP_NAME}
                </span>
                <span className="text-sm text-foreground/70">
                  From zero to production in minutes
                </span>
              </div>

              <h1
                className="text-[2.5rem] sm:text-6xl md:text-7xl font-bold leading-[1.1] text-foreground max-w-4xl mx-auto tracking-tight"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Start Building.
              </h1>

              <p
                className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Auth, real-time database, file storage, and AI baked in.
                One stack, zero config — just ship.
              </p>

              {/* CTA row */}
              <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
                {isAuthenticated ? (
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-12 text-base"
                  >
                    <Link to="/dashboard">
                      Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-8 h-12 text-base"
                  >
                    <Link to="/signup">
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}

                <div className="flex items-center gap-2 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/30 dark:border-white/10 px-4 py-2">
                  <span className="text-lg font-bold text-primary">5</span>
                  <span className="text-xs text-muted-foreground text-left leading-tight">
                    built-in
                    <br />
                    integrations
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Floating cards (desktop only) ── */}
          <div className="hidden lg:block">
            {/* Card 1: Real-time — left */}
            <div
              className="absolute top-[58%] left-[4%] z-[8] w-52 rounded-2xl bg-card border border-border/50 p-4 shadow-lg"
              style={{ animation: "landing-float1 6s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Real-time Queries
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-foreground">
                  2.4k
                </span>
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" /> +12.5%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Live subscriptions active
              </p>
            </div>

            {/* Card 2: Auth — right */}
            <div
              className="absolute top-[55%] right-[4%] z-[8] w-56 rounded-2xl bg-card border border-border/50 p-4 shadow-lg"
              style={{ animation: "landing-float2 7s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Auth Providers
                </span>
              </div>
              <div className="flex items-center gap-4">
                {/* Mini circular gauge */}
                <div className="relative h-14 w-14 flex-shrink-0">
                  <svg
                    className="h-14 w-14 -rotate-90"
                    viewBox="0 0 56 56"
                  >
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="currentColor"
                      className="text-border"
                      strokeWidth="4"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      className="stroke-primary"
                      strokeWidth="4"
                      strokeDasharray={`${0.99 * 2 * Math.PI * 24} ${2 * Math.PI * 24}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
                    3
                  </span>
                </div>
                <div className="space-y-1 text-[10px]">
                  {["Password", "GitHub", "Google"].map((p, i) => (
                    <div key={p} className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        style={{ opacity: 1 - i * 0.25 }}
                      />
                      <span className="text-muted-foreground">
                        {p}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 3: Storage — bottom center */}
            <div
              className="absolute bottom-[10%] left-[55%] -translate-x-1/2 z-[8] w-56 rounded-2xl bg-card border border-border/50 p-4 shadow-lg"
              style={{ animation: "landing-float3 8s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  File Storage
                </span>
                <span className="ml-auto text-[10px] text-green-600 dark:text-green-400">
                  +23%
                </span>
              </div>
              {/* Mini bar chart */}
              <div className="flex items-end gap-1 h-8">
                {[40, 65, 45, 70, 55, 80, 60, 75, 90, 70, 85, 95].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-foreground/15"
                      style={{ height: `${h}%` }}
                    />
                  ),
                )}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                Direct R2 uploads via presigned URLs
              </p>
            </div>

            {/* Card 4: Email — bottom left */}
            <div
              className="absolute bottom-[8%] left-[22%] z-[8] w-52 rounded-2xl bg-card border border-border/50 p-4 shadow-lg"
              style={{ animation: "landing-float4 7.5s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Email Delivery
                </span>
              </div>
              <div className="space-y-1.5">
                {["Welcome", "Reset Password", "Custom"].map((t, i) => (
                  <div key={t} className="flex items-center gap-2">
                    <div
                      className="h-1 flex-1 rounded-full bg-foreground/10 overflow-hidden"
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${[92, 78, 65][i]}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-16 text-right">
                      {t}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-2">
                Resend &amp; SMTP with custom templates
              </p>
            </div>
          </div>

          {/* ── Background image ── */}
          <div className="absolute inset-0 z-[5]">
            <img
              src="/default-background-image.webp"
              alt=""
              className="h-full w-full object-cover object-bottom dark:hidden"
            />
            <img
              src="/default-background-image-dark.webp"
              alt=""
              className="h-full w-full object-cover object-bottom hidden dark:block"
            />
            {/* Fade gradient to blend image into the page */}
            <div
              className="absolute inset-x-0 top-0 h-[60%] pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, #dbe8f4 0%, #efd8e6 30%, transparent 100%)",
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-[60%] pointer-events-none hidden dark:block"
              style={{
                background:
                  "linear-gradient(180deg, #0C0C12 0%, #12101a 30%, transparent 100%)",
              }}
            />
          </div>
        </div>

      </div>
    </>
  );
}
