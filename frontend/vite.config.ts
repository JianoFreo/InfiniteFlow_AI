import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In `npm run dev`, /api is proxied to the BFF (only the BFF, never a microservice directly).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.API_PROXY_TARGET ?? "http://localhost:5000", changeOrigin: true },
    },
  },
});
