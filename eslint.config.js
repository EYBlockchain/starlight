import globals from "globals";
import pluginJs from "@eslint/js";
import pluginTs from "@typescript-eslint/eslint-plugin";


export default [
  {
  languageOptions: { 
   globals: globals.browser,
   parser: "@typescript-eslint/parser", }},
   pluginJs.configs.recommended,
  {
    rules: {
      "no-underscore-dangle": "off",
      "no-console": "warn",
      "no-plusplus": "error",
      "import/extensions": "off",
      "no-restricted-syntax": "off",
      "no-restricted-globals": "off",
      "no-cond-assign": "off",
      "semi": ["error", "always"], 
      "quotes": ["error", "double"], 
      "@typescript-eslint/no-unused-vars": ["warn"],
    },
  },
  {
    plugins: {
      "@typescript-eslint": pluginTs,
    },
  }
];