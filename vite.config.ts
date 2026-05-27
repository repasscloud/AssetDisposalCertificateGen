import { defineConfig } from "vite";

export default defineConfig({
  // In CI the workflow passes VITE_BASE=/RepoName/ so assets resolve correctly
  // on a GitHub Pages project site.  Locally, "./" keeps everything working
  // with `vite dev` and `vite preview` without any extra config.
  base: process.env.VITE_BASE ?? "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
