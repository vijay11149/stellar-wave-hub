import tseslint from "typescript-eslint";
import pluginJs from "@eslint/js";

export default tseslint.config(
  { ignores: ["**/.next/**", "**/node_modules/**", "**/dist/**"] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "prefer-const": "off",
    },
  },
  {
    files: ["src/app/api/projects/trending/route.ts", "src/app/page.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": "error",
      "prefer-const": "error",
    },
  },
);
