/// <reference types="vite/client" />
import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CONVEX_URL = (import.meta as any).env.VITE_CONVEX_URL!;
  if (!CONVEX_URL) {
    throw new Error("VITE_CONVEX_URL is not set");
  }

  const convexQueryClient = new ConvexQueryClient(CONVEX_URL, {
    expectAuth: true,
  });

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = routerWithQueryClient(
    createRouter({
      routeTree,
      defaultPreload: "intent",
      context: { queryClient, convexQueryClient },
      scrollRestoration: true,
    }),
    queryClient,
  );

  return router;
}
