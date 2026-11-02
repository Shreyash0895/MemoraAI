import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const api = { "/api": { target: "http://localhost:4000", changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  // host: true lets a phone or tablet on the same Wi-Fi open the patient screen (http://<your-computer-ip>:5173/companion)
  server: { port: 5173, open: true, host: true, proxy: api },
  preview: { proxy: api },
});
