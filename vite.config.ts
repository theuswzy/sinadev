// @lovable.dev/vite-tanstack-config already includes the TanStack Start,
// React, Tailwind, Nitro and path-alias plugins used by the project.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";
import path from "node:path";

export default defineConfig((({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const serverEnv = loadEnv(mode, process.cwd(), "");
  Object.assign(process.env, serverEnv);
  const supabaseUrl = env["VITE_SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"] || "";
  const supabasePublishableKey =
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] || "";

  return { vite: {
    // Publishable Supabase credentials are safe to expose to the browser.
    // Never place a service_role/secret key here.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
    },
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(process.cwd(), "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(process.cwd(), "node_modules/entities/lib/encode.js"),
        entities: path.resolve(process.cwd(), "node_modules/entities"),
      },
    },
  },
  tanstackStart: {
    // Keep the SSR error wrapper as the TanStack Start server entry.
    server: { entry: "server" },
  },
  };
}) as any);
