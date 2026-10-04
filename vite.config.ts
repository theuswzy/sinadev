// @lovable.dev/vite-tanstack-config already includes the TanStack Start,
// React, Tailwind, Nitro and path-alias plugins used by the project.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const supabaseUrl = process.env["VITE_SUPABASE_URL"] || "https://zwapwxbczezqfghenrgy.supabase.co";
const supabasePublishableKey =
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
  "sb_publishable_QpU6A-n7yUgkh715QYMQdA_Lrj5miip";

export default defineConfig({
  vite: {
    // Publishable Supabase credentials are safe to expose to the browser.
    // Never place a service_role/secret key here.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
    },
  },
  tanstackStart: {
    // Keep the SSR error wrapper as the TanStack Start server entry.
    server: { entry: "server" },
  },
});
