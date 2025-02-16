const isNumber = require("is-number");

console.log("Hello, this is a test of GH Actions and PNPM");
console.log(
  "There are some issues with GH Actions, Corepack, and PNPM, see https://vercel.com/guides/corepack-errors-github-actions or https://github.com/nodejs/corepack/issues/612.",
);

console.log(`NaN is ${isNumber(NaN) ? "a number" : "not a number"}`);
