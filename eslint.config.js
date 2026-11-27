import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

export default defineConfig([
  // ESLint doesn't read .gitignore; keep these in step with it.
  globalIgnores(["dist/", "coverage/"]),
  js.configs.recommended,
  {
    // The extension: plain browser scripts, no modules or bundler (until plan chunk 1.4).
    files: ["src/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: { ...globals.browser, ...globals.webextensions },
    },
    rules: {
      // Top-level leftovers in popup.js are removed in plan chunk 2.3, not here.
      "no-unused-vars": ["error", { vars: "local" }],
    },
  },
  {
    files: ["src/background.js"],
    languageOptions: { globals: globals.serviceworker },
  },
  {
    // Dev tooling (this file, scripts/) runs in Node.
    files: ["*.js", "scripts/**/*.js"],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
