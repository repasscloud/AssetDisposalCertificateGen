import { defineConfig } from "vite";

export default defineConfig({
  // VITE_BASE can be overridden by CI.  Defaults to "/" for Cloudflare Pages
  // (custom subdomain = root path).  Use "./" only when serving from a
  // sub-path (e.g. a GitHub Pages project site).
  base: process.env.VITE_BASE ?? "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
