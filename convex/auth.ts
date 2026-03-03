import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google, GitHub, Password],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      // Only fire for newly created users
      if (existingUserId) return;

      const user = await ctx.db.get(userId);
      if (!user?.email) return;

      const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
      const name = user.name ?? user.email.split("@")[0];

      await ctx.scheduler.runAfter(
        0,
        internal.emails.createEmailLog,
        {
          to: user.email,
          template: "welcome" as const,
          templateData: JSON.stringify({
            name,
            loginUrl: `${siteUrl}/dashboard`,
          }),
        }
      );
    },
  },
});
