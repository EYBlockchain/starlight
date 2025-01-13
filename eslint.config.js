import globals from "globals";
import pluginJs from "@eslint/js";
import pluginTs from "@typescript-eslint/eslint-plugin";
import parser from "@typescript-eslint/parser";
import eslintConfigPrettier from "eslint-config-prettier";
import prettierPlugin from "eslint-plugin-prettier";


export default [
  eslintConfigPrettier,
  
  {
  languageOptions: { 
   globals: globals.browser,
   parser: parser, 
   parserOptions: {
     ecmaVersion: 2020, 
     sourceType: "module", 
   }, 
  }},
  
   pluginJs.configs.recommended,

   {
    rules: {
      "no-underscore-dangle": "off",
      "no-console": "warn",
      "no-plusplus": "warn",
      "import/extensions": "off",
      "no-restricted-syntax": "off",
      "no-restricted-globals": "off",
      "no-cond-assign": "off",
      "no-undef": "error",
      "semi": ["error", "always"], 
      "quotes": ["error", "double"], 
      "@typescript-eslint/no-unused-vars": ["warn"],
      indent: ["error", 2],
      "prettier/prettier": "error",
    
    },
  },
  {
    plugins: {
      "@typescript-eslint": pluginTs,
      prettier: prettierPlugin,

    
    },
  }
];

