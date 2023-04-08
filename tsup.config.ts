import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["./src/index.ts"],
  dts: {
    resolve: true,
  },
  format: ["cjs", "esm"],
});
