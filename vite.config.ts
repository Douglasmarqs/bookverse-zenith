import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";

/**
 * BookVerse build.
 *
 * Nitro picks the deploy target automatically (Vercel, Netlify,
 * Cloudflare… are detected from their build environments; anywhere else it
 * produces a Node server in .output/). Force one with NITRO_PRESET, e.g.
 * `NITRO_PRESET=vercel npm run build`.
 */
export default defineConfig(({ command }) => ({
  server: { port: 8080 },
  define: {
    // Firebase web API key — a public identifier, injected at build time.
    __FIREBASE_API_KEY__: JSON.stringify(process.env.GOOGLE_API_KEY ?? ""),
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    ...(command === "build" ? [nitro()] : []),
    viteReact(),
  ],
}));
