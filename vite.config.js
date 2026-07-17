import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages project sites, the app is served from
//   https://<user>.github.io/<repo>/
// so the base must be "/<repo>/". Set via env in the deploy workflow,
// falling back to "/" for local dev.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
});
