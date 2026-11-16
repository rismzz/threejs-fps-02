// STEELHAVEN — entrypoint for the make.fun program/v1 harness.
// The grader runs `node /bot/main.ts`; this copies the static game
// (index.html + src/) into the output directory, deterministically.
import { cpSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

mkdirSync(out, { recursive: true });
cpSync(join(root, "index.html"), join(out, "index.html"));
cpSync(join(root, "src"), join(out, "src"), { recursive: true });

console.log(`STEELHAVEN written to ${out}`);
