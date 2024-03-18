import { normalizePath, type Plugin } from "vite";
import type { Config } from "./types";
import { generateBoilerplate } from "./boilerplate";
import glob from "fast-glob";
import { dirname, resolve } from "path";
import { createServer } from "./server/create";
import { hotupdate } from "./server/hot";

export const multipage = (config?: Config): Plugin => {
  const root = config?.directory || "src/pages";
  let framework = "";

  return {
    name: "vite-plugin-multi-page",
    config: () => {
      const pages = glob.sync("**/*.{svelte,vue,tsx,jsx}", {
        cwd: root,
        onlyFiles: true,
      });

      const entries = pages.map((page, i) => {
        // Get framework from file extension
        if (i === 0 && !framework) framework = page.split(".").pop() || "";

        const name = dirname(page);

        if (name === "." || !name) return "index";

        return name;
      });

      const input = entries.reduce((acc: Record<string, string>, page) => {
        const fileName = "index.html";

        if (page === "index") {
          acc[page] = resolve(root, fileName);
          return acc;
        }

        acc[page] = resolve(root, page, fileName);

        return acc;
      }, {});

      return {
        root,
        appType: "custom",
        build: {
          outDir: "dist",
          rollupOptions: {
            input,
            output: {
              format: "es",
              strict: false,
              entryFileNames: "assets/[name]-[hash].js",
              chunkFileNames: "assets/[name]-[hash].js",
              assetFileNames: "assets/[name]-[hash].[ext]",
              dir: "dist/",
            },
          },
        },
      };
    },

    resolveId(id) {
      return id.includes("index.html") ? id : null;
    },

    async load(id) {
      if (framework === "") throw new Error("Framework not found");

      const fileName = "index.html";

      if (!id.endsWith(fileName)) return null;

      id = normalizePath(id);

      const page = id.replace(fileName, `index.${framework}`);

      return generateBoilerplate(page, framework, config || {})
    },

    configureServer: createServer,
    handleHotUpdate: hotupdate,
  };
};
