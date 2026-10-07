import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
export default defineConfig([
...tseslint.configs.recommended,
{ files: ["**/*.tsx"], plugins: { "react-hooks": reactHooks }, rules: { "react-hooks/rules-of-hooks": "error", "react-hooks/exhaustive-deps": "error" } },
{ files: ["src/components/**/*.tsx", "src/modules/**/domain/**/*.ts", "src/modules/**/contracts/**/*.ts"], rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@prisma/*", "@/generated/*", "@/modules/*/infrastructure/*"], message: "Use contracts and application boundaries." }] }] } },
globalIgnores([".next/**","node_modules/**","src/generated/**",".cache/**","playwright-report/**","test-results/**","next-env.d.ts"]),
]);
