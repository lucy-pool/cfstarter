import nextConfig from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextConfig,
  {
    files: ["convex/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "./_generated/server",
              importNames: ["query", "mutation"],
              message:
                "Use userQuery/userMutation/adminQuery/adminMutation from './functions' instead. Use raw query/mutation only for explicitly public endpoints (add eslint-disable comment).",
            },
          ],
        },
      ],
    },
  },
];
