// 린트 기준: ESLint 권장 규칙. `npm run lint`로 돈다.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "public/**", "tools/**"] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // 기존 코드에 안 쓰는 변수가 30곳 있어 경고로 둔다. 실패로 올리려면 먼저 정리한다.
      "no-unused-vars": "warn",
    },
  },
  {
    // 이름에서 제어 문자(\x00-\x1f)를 지우는 정규식이라 의도된 것이다.
    files: ["src/logic/workshop.js"],
    rules: { "no-control-regex": "off" },
  },
];
