import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts", "./src/effectful.ts"],
  dts: {
    resolve: true,
  },
  format: ["cjs", "esm"],
});
