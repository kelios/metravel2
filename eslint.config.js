const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");

const baseIgnores = [
  "node_modules/",
  ".expo/",
  "dist/",
  "web-build/",
  "coverage/",
  "playwright-report/",
  "playwright-report/**",
  "**/playwright-report/**",
  "test-results/",
  "jest-results.json",
  "jest-full.log"
];

module.exports = [
  { ignores: baseIgnores },
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "warn"
    }
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        ...globals.browser
      }
    },
    rules: {
      "no-undef": "off"
    }
  },
  {
    files: [
      "scripts/**/*.{js,ts,mjs,cjs}",
      "*.config.{js,ts,mjs,cjs}",
      ".*rc.{js,cjs,mjs,ts}",
      "babel.config.*",
      "metro.config.*"
    ],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    files: ["entry.js", "metro-stubs/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: [
      "**/__tests__/**/*.{js,jsx,ts,tsx}",
      "**/?(*.)+(spec|test).{js,jsx,ts,tsx}",
      "tests/**/*.{js,jsx,ts,tsx}",
      "e2e/**/*.{js,ts}"
    ],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "no-console": "off"
    }
  }
];
