#!/usr/bin/env bash
# Reproducible local gate. No network, no restart, no profile mutation.
set -euo pipefail
cd "$(dirname "$0")/.."

echo '[verify] typecheck'
node scripts/build.mjs --check

echo '[verify] build'
node scripts/build.mjs

echo '[verify] syntax'
for file in index.js service.js routes.js html.js types.js client.js; do
  node --check "$file"
done

echo '[verify] unit and route tests'
node --test tests/*.test.mjs

echo '[verify] placeholders'
if grep -n '__DICT_ZH__\|__DICT_EN__\|__PANEL_CSS__' client.js; then
  echo '[verify] FAIL: unresolved client placeholder' >&2
  exit 1
fi

echo '[verify] manifest and package contents'
node --input-type=module -e '
import { readFileSync, existsSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.name !== "dsh-mobile-access") throw new Error("unexpected package name");
if (pkg.private === true) throw new Error("package must be publishable");
if (pkg.publishConfig?.access !== "public") throw new Error("publishConfig.access must be public");
if (pkg.dsh?.bundle?.patch !== "./cordis.patch.yml") throw new Error("bundle patch missing");
if (pkg.dsh?.client?.platform !== "web") throw new Error("client platform missing");
for (const file of pkg.files) {
  if (file.includes("*")) continue;
  if (!existsSync(file)) throw new Error(`missing packaged file: ${file}`);
}
for (const file of ["README.md", "LICENSE", "CHANGELOG.md", "docs/acceptance.md"]) {
  if (!existsSync(file)) throw new Error(`missing deliverable: ${file}`);
}
console.log("[verify] manifest OK");
'

echo '[verify] npm pack dry run'
npm pack --dry-run >/dev/null

echo '[verify] PASS'
