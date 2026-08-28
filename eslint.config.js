const js = require("@eslint/js");
const prettier = require("eslint-config-prettier");
const globals = require("globals");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const reactHooks = require("eslint-plugin-react-hooks");
const reactPlugin = require("eslint-plugin-react");

const linkingOpenUrlGuard = [
  "error",
  {
    selector:
      "CallExpression[callee.type='MemberExpression'][callee.object.name='Linking'][callee.property.name='openURL']",
    message: "Use '@/utils/externalLinks.openExternalUrl' instead of direct Linking.openURL.",
  },
];

const baseIgnores = [
  "node_modules/",
  ".tmp/",
  ".tmp/**",
  ".expo/",
  ".expo-shared/",
  ".prod-build-tmp/",
  "dist/",
  "dist-stub/",
  "dist-web-analyze/",
  "dist-web-analyze-sm/",
  "dist-*-diag/",
  "dist-*-diag/**",
  "web-build/",
  "coverage/",
  "coverage-*/",
  "coverage-*/**",
  ".nyc_output/",
  "tmp/",
  "output/",
  ".claude/",
  ".claude/**",
  ".codex-temp/",
  ".codex-temp/**",
  ".codex-debug/",
  ".codex-debug/**",
  // Рабочие каталоги аудитов и временных прогонов (все перечислены в .gitignore)
  ".quest-audit/",
  ".quest-audit/**",
  ".quest-snapshots/",
  ".quest-snapshots/**",
  ".chk-web/",
  ".chk-web/**",
  ".chk-android/",
  ".chk-android/**",
  ".chk-e2e/",
  ".chk-e2e/**",
  ".tmp-article/",
  ".tmp-article/**",
  ".tmp-pdf-preview/",
  ".tmp-pdf-preview/**",
  ".debug-shots/",
  ".debug-shots/**",
  ".backup/",
  ".backup/**",
  "backup/",
  "backup/**",
  "dump/",
  "dump/**",
  "undefined/",
  "undefined/**",
  "travel-drafts/",
  "travel-drafts/**",
  "artifacts/",
  "artifacts/**",
  "lighthouse-reports/",
  "lighthouse-reports/**",
  "scripts/.workflows/",
  "scripts/.workflows/**",
  "scripts/.seo-*/",
  "scripts/.seo-*/**",
  "scripts/.fix-*/",
  "scripts/.fix-*/**",
  "scripts/.tmp-*",
  "scripts/.tmp-*/**",
  "scripts/.migrate-description-images/",
  "scripts/.migrate-description-images/**",
  "scripts/.quest-review/",
  "scripts/.quest-review/**",
  "scripts/.index-cache/",
  "scripts/.index-cache/**",
  "playwright-report/",
  "playwright-report/**",
  "**/playwright-report/**",
  ".playwright-report-extracted/",
  ".playwright-report-extracted/**",
  ".playwright-mcp/",
  ".playwright-mcp/**",
  ".playwright-cli/",
  ".playwright-cli/**",
  "playwright-screenshots/",
  "playwright-screenshots/**",
  "test-results/",
  "e2e/.auth/",
  "e2e/.auth/**",
  "e2e/_flicker-shots/",
  "e2e/_flicker-shots/**",
  "e2e/__screenshots__/",
  "e2e/__screenshots__/**",
  // Нативные и bundler-артефакты сборки
  "android/",
  "android/**",
  ".gradle/",
  ".gradle/**",
  ".next/",
  ".swc/",
  ".turbo/",
  ".parcel-cache/",
  ".cache/",
  "jest-results.json",
  "jest-full.log",
  // Одноразовые диагностические скрипты в корне (напр. __map_diag*.mjs, _tmp-*.mjs)
  "__*.mjs",
  "_tmp-*",
  "app/+html.tsx"
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
    plugins: {
      "react-hooks": reactHooks,
      react: reactPlugin
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-restricted-syntax": linkingOpenUrlGuard,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
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
    plugins: {
      "@typescript-eslint": tsPlugin
    },
    rules: {
      "no-undef": "off",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-restricted-syntax": linkingOpenUrlGuard,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ],
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-ignore": "allow-with-description",
          "ts-expect-error": "allow-with-description",
          "ts-nocheck": true,
          minimumDescriptionLength: 10
        }
      ]
    }
  },
  // B1: Prevent new `any` in core modules (api, hooks, stores)
  {
    files: ["api/**/*.ts", "hooks/**/*.ts", "stores/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": [
        "warn",
        {
          fixToUnknown: true
        }
      ]
    }
  },
  {
    files: ["utils/externalLinks.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  },
  {
    files: ["__mocks__/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    rules: {
      "no-redeclare": "off"
    }
  },
  {
    files: [
      "scripts/**/*.{js,ts,mjs,cjs}",
      ".grok/**/*.{js,mjs,cjs}",
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
    files: ["utils/runtimeConfigContract.js"],
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
