// Copies static assets into dist/ and marks each module folder so Node
// resolves dist/cjs as CommonJS and dist/esm as ESM.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "dist", "cjs"), { recursive: true });
mkdirSync(join(root, "dist", "esm"), { recursive: true });

for (const css of ["token.css", "veil.css"]) {
  copyFileSync(join(root, "src", css), join(root, "dist", css));
}
writeFileSync(join(root, "dist", "cjs", "package.json"), JSON.stringify({ type: "commonjs" }) + "\n");
writeFileSync(join(root, "dist", "esm", "package.json"), JSON.stringify({ type: "module" }) + "\n");
console.log("mark: css + module markers copied to dist/");
