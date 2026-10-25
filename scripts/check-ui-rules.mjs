// Project UI rules that ESLint does not cover:
//  1. No emoji anywhere in source (UI must use Lucide icons).
//  2. RTL: no physical-direction Tailwind utilities (ml-, pr-, left-, text-right, ...);
//     use logical ones (ms-, pe-, start-, text-end, ...).
//  3. Bidi: no Arabic letter written directly against a Latin one («وWord»); the bidi algorithm
//     moves the Arabic letter across the Latin run. Use ltr() and arabicList() from src/lib/format.
// Usage: node scripts/check-ui-rules.mjs  (run as part of `npm run lint`)

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SCAN = ["src", "prisma/seed"];
const SKIP = ["src/generated"];
const EXT = /\.(tsx?|css|json|mjs)$/;

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
const GLUED_BIDI = /[ء-ي][A-Za-z]|[A-Za-z][ء-ي]/;
const PHYSICAL =
  /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|scroll-ml|scroll-mr)-[\w./[\]-]+|text-left|text-right|float-left|float-right)(?![\w-])/;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const rel = relative(ROOT, path).replaceAll("\\", "/");
    if (SKIP.some((s) => rel.startsWith(s))) continue;
    if (statSync(path).isDirectory()) yield* files(path);
    else if (EXT.test(name)) yield path;
  }
}

const problems = [];
for (const dir of SCAN) {
  for (const file of files(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replaceAll("\\", "/");
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (EMOJI.test(line)) problems.push(`${rel}:${i + 1}  emoji is not allowed`);
        const isComment = /^\s*(\/\/|\/\*|\*)/.test(line);
        const glued = !isComment && line.match(GLUED_BIDI);
        if (glued) problems.push(`${rel}:${i + 1}  Arabic and Latin letters touch ("${glued[0]}"); isolate the Latin term with ltr()`);
        if (/\.(tsx|css)$/.test(rel) && !isComment) {
          const m = line.match(PHYSICAL);
          if (m) problems.push(`${rel}:${i + 1}  physical direction "${m[0]}"; use a logical utility`);
        }
      });
  }
}

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} UI rule violation(s).`);
  process.exit(1);
}
console.log("UI rules: ok");
