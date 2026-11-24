import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Cross-document-style transitions between pages (cover → reader, etc.)
    // where the browser supports the View Transitions API.
    defaultViewTransition: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
