import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    define: {
      __FIREBASE_API_KEY__: JSON.stringify(process.env.GOOGLE_API_KEY ?? ""),
    },
  },
});
