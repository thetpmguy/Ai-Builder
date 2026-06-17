import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes the built asset paths relative, so the app works whether it's
// served from a domain root (Netlify/Vercel) or a subpath (GitHub Pages /repo-name/).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
