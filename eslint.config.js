// @ts-check

const eslint = require("@eslint/js");
const tseslint = require("typescript-eslint");
const eslintConfigPrettier = require("eslint-config-prettier");

module.exports = tseslint.config(
    {
        ignores: [
            "**/dist/", // Ignoriere den Build-Ordner
            "**/*.config.js", // Ignoriere Konfigurationsdateien
            "**/*.test.ts", // Ignoriere alle TypeScript-Testdateien
            "**/*.spec.ts", // Ignoriere alle TypeScript-Spec-Dateien
        ]
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommended,

    {
        rules: {
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "caughtErrorsIgnorePattern": "^_"
                }
            ]
        }
    },

    eslintConfigPrettier
);
