import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];

if (mode !== "dev" && mode !== "build") {
  throw new Error('Usage: node scripts/prepare-next-env.mjs <"dev"|"build">');
}

const routeTypesPath =
  mode === "dev" ? ".next/dev/types/routes.d.ts" : ".next/types/routes.d.ts";
const content = [
  '/// <reference types="next" />',
  '/// <reference types="next/image-types/global" />',
  `import "./${routeTypesPath}";`,
  "",
  "// NOTE: This file should not be edited",
  "// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.",
  "",
].join("\n");
const scriptDirectory = dirname(fileURLToPath(import.meta.url));

await writeFile(
  resolve(scriptDirectory, "..", "next-env.d.ts"),
  content,
  "utf8",
);
