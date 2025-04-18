import type { Plugin } from "vite";
import type { Config } from "./types";
import { resolve } from "./utils/resolve";
import { getExternalDeps } from "./utils/config";
import { getInputs, type Frameworks } from "./utils/input";
import { getPageFromIndex } from "./utils/page";
import { configureServerMiddlewares, handleRestart } from "./server";
import { load } from "./load";
import glob from "tiny-glob";
import path from "path";

export const multip = (config?: Config): Plugin => {
  const root = config?.directory || "src/pages";
  const frameworks: Frameworks = {};

  return {
    name: "vite-plugin-multip",
    enforce: "pre",
    async config(viteConfig, env) {
      const pages = await glob("**/*.{svelte,vue,tsx,jsx,md,html}", {
        cwd: root,
        filesOnly: true,
      });

      const [input, recognizedFrameworks] = getInputs(pages, root, viteConfig);

      Object.assign(frameworks, recognizedFrameworks);

      if (!input) throw new Error("No pages found");

      const isDev = env.command !== "build";

      const publicDir = path.join(
        "../../",
        viteConfig.publicDir || "public/"
      );

      const distDir = path.join(
        "../../",
        viteConfig.build?.outDir || "dist/"
      );

      return {
        root: !isDev ? root : "./",
        optimizeDeps: {
          include: getExternalDeps(frameworks),
        },
        publicDir: !isDev ? publicDir : viteConfig.publicDir || "public/",
        build: {
          outDir: distDir,
          emptyOutDir: true,
          rollupOptions: {
            input: !isDev ? input : {},
          },
        },
      };
    },

    resolveId(id) {
      return id.includes("index.html") ? id : null;
    },

    async load(id) {
      const fileName = "index.html";
      if (!id.endsWith(fileName)) return null;

      id = resolve(id);

      const framework = frameworks[id];

      if (!framework) return null;

      const page = id.replace(fileName, `index.${framework.ext}`);

      return await load(page, framework, config || {}, false);
    },

    async transformIndexHtml(_, ctx) {
      if (!ctx.server || !ctx.originalUrl || ctx.server.config.command === "build") return;

      const originalUrl = ctx.originalUrl.split("?")[0];

      if (!originalUrl) return;

      const page = getPageFromIndex(ctx, { frameworks, root, originalUrl });

      if (!page) return;

      return await load(page.file, page.framework, config || {}, true);
    },

    configResolved(config) {
      // Replace ../../ from build logs (is pretty ugly)
      if (config.command === "build") {
        config.logger.info = (msg) => {
          console.info(msg.replace("../../", ""));
        }
      }
    },

    configureServer(server) {
      configureServerMiddlewares(server, { root, frameworks, config: config || {} })

      server.watcher.add("**/*.{svelte,vue,tsx,jsx,md,html,css,scss,sass,less,js,ts}");

      server.watcher.on("add", (file) => {
        handleRestart(server, file);
      });

      server.watcher.on("unlink", (file) => {
        handleRestart(server, file);
      });
    },
  };
};
