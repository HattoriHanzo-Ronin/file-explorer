const { fixupConfigRules } = require("@eslint/compat");
const { defineConfig } = require("eslint/config");
const reactNativeConfig = require("@react-native/eslint-config/flat");

module.exports = defineConfig([
    fixupConfigRules(reactNativeConfig),
    {
        rules: {
            curly: ["error", "all"],
            eqeqeq: ["warn", "always"],
            "no-else-return": "warn",
            "no-var": "error",
            "prefer-const": "warn",
            "object-shorthand": ["error", "always"],
            "no-unused-vars": "warn",
            "no-void": "off",
            "consistent-return": "warn",
            "arrow-body-style": ["warn", "as-needed"],
            complexity: ["warn", 10]
        }
    },
    {
        ignores: ["dist/**", "android/**", "ios/**", "coverage/**"]
    }
]);
