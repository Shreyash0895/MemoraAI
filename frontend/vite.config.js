import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = { "/api": { target: "http://localhost:4000", changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true, proxy: api },
  preview: { proxy: api },
});
