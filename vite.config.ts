import { defineConfig } from "vite";
import path from "node:path";

const aliases = {
  "@fp/types": path.resolve(import.meta.dirname, "src/types/index.ts"),
  "@fp/units": path.resolve(import.meta.dirname, "src/units/index.ts"),
  "@fp/geometry": path.resolve(import.meta.dirname, "src/geometry/index.ts"),
  "@fp/catalog": path.resolve(import.meta.dirname, "src/catalog/index.ts"),
  "@fp/doors": path.resolve(import.meta.dirname, "src/doors/index.ts"),
  "@fp/demo": path.resolve(import.meta.dirname, "src/demo/index.ts"),
  "@fp/snap": path.resolve(import.meta.dirname, "src/snap/index.ts"),
  "@fp/interact": path.resolve(import.meta.dirname, "src/interact/index.ts"),
  "@fp/visualizer": path.resolve(import.meta.dirname, "src/visualizer/index.ts"),
  "@fp/projects": path.resolve(import.meta.dirname, "src/projects/index.ts"),
  "@fp/app": path.resolve(import.meta.dirname, "src/app/index.ts"),
};

export default defineConfig({
  resolve: { alias: aliases },
  server: {
    port: 8765,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 8765,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
