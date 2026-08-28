import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // The approved design artifact, as the designer exported it. It is under
    // version control so the rebuilt pages can be diffed against the thing
    // that was actually approved, and its bundled runtime (support.js) is
    // vendor code this repo never ships and will never edit. Linting it put
    // two errors about somebody else's React 17 bundle on every run, which
    // trains the eye to skip a red line.
    "design-reference/**",
  ]),
]);

export default eslintConfig;
