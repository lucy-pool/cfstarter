import { betterAuth } from "better-auth/minimal";
import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import authConfig from "./auth.config";
import { components } from "./_generated/api";
import type { GenericCtx } from "@convex-dev/better-auth";
import type { DataModel } from "./_generated/dataModel";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: process.env.SITE_URL ?? "http://localhost:3000",
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],
  });
};

// TODO: Wire up welcome email hook (previously afterUserCreatedOrUpdated callback).
// Better Auth supports triggers via createClient config — use the `triggers` option
// with an `onCreate` handler on the user model to schedule the welcome email.
// See: https://labs.convex.dev/better-auth for trigger examples.
