import type { Plugin } from "vite";
import type { Config } from "./types";
import glob from "tiny-glob";
import { generateBoilerplate } from "./boilerplate";
import { dirname } from "path";
import { resolve } from "./utils/resolve";
import { createServer } from "./server/create";
import { hotupdate } from "./server/hot";
import copy from 'rollup-plugin-copy';

export const multipage = (config?: Config): Plugin => {
  const root = config?.directory || "src/pages";
  const assets = config?.assets || [];
  let framework = config?.framework || "";

  return {
    name: "vite-plugin-multi-page",
    async config() {
      const pages = await glob("**/*.{svelte,vue,tsx,jsx}", {
        cwd: root,
        filesOnly: true,
      });

      const entries = pages.map((page) => {
        // Get framework from file extension
        if (!framework) framework = page.split(".").pop() || "";

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
        build: {
          outDir: "dist",
          emptyOutDir: true,
          rollupOptions: {
            input,
            output: {
              dir: "dist",
            },
            plugins: [
              copy({
                targets: [
                  { src: 'public/*', dest: 'dist/' },
                  ...assets,
                ],
              }),
            ]
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

      id = resolve(id);

      const page = id.replace(fileName, `index.${framework}`);

      const layouts = await glob("../**/layout.html", {
        cwd: dirname(id),
        filesOnly: true,
      });

      if (layouts.length < 1 || typeof layouts[0] != "string") return await generateBoilerplate(page, framework, config || {}, "");

      const nearestLayout = layouts.sort((a, b) => {
        return a.split("/").length - b.split("/").length;
      });

      if (nearestLayout.length < 1 || typeof nearestLayout[0] != "string") throw new Error("Nearest layout not found");

      const layout = resolve(dirname(id), nearestLayout[0]);

      return await generateBoilerplate(page, framework, config || {}, layout);
    },

    configureServer: createServer,
    handleHotUpdate: hotupdate,
  };
};
