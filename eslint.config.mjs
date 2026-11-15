import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierRecommended from 'eslint-plugin-prettier/recommended';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { ...prettierRecommended, files: ['src/**/*.{ts,tsx}', 'tests/unit/**/*.{ts,mjs}', 'scripts/lib/*.mjs'] },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-browser-test/**",
    "test-results/**",
    "playwright-report/**",
    "out/**",
    "build/**",
    ".deployment/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
