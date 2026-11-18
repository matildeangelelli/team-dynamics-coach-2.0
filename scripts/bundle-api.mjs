import { build } from "vite"

for (const name of ["analyze", "status"]) {
  await build({
    configFile: false,
    logLevel: "warn",
    publicDir: false,
    build: {
      ssr: `server/entries/${name}.ts`,
      outDir: "api",
      emptyOutDir: false,
      copyPublicDir: false,
      minify: false,
      target: "node22",
      rollupOptions: {
        output: {
          format: "es",
          entryFileNames: `${name}.js`,
        },
      },
    },
  })
}
