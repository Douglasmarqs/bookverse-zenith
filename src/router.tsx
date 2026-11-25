import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Page changes animate inside the app (see .page-enter): the browser's
    // View Transitions blinked and hid the fixed tab bar on some phones.
    defaultViewTransition: false,
    // Load a page's code as soon as a finger touches its link, so the
    // switch never waits on the network.
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
