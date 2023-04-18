import { defineConfig } from "vitest/config";
import GithubActionsReporter from "vitest-github-actions-reporter";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    reporters: !process.env.GITHUB_ACTIONS
      ? ["default"]
      : ["default", new GithubActionsReporter()],
  },
});
