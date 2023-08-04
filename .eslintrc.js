module.exports = {
  env: {
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "prettier",
    "plugin:node/recommended",
    "plugin:eslint-plugin/recommended",
  ],

  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["prettier"],
  rules: {
    "no-unused-vars": "warn",
    "func-names": "off",
  },
}
