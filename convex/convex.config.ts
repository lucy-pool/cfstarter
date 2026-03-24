import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config.js";
import betterAuth from "@convex-dev/better-auth/convex.config";

const app = defineApp();
app.use(r2);
app.use(betterAuth);

export default app;
