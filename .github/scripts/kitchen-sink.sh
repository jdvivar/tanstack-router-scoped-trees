#!/usr/bin/env bash
set -euo pipefail

routes_source="$1"
package_tarball="$2"
app_dir="$(mktemp -d)"

mkdir -p "$app_dir/src"
cp -R "$routes_source" "$app_dir/src/routes"

cat > "$app_dir/package.json" <<JSON
{
  "name": "kitchen-sink-stress-test",
  "private": true,
  "type": "module"
}
JSON

cat > "$app_dir/tsr.config.json" <<JSON
{
  "target": "react",
  "routesDirectory": "./src/routes",
  "generatedRouteTree": "./src/routeTree.gen.ts"
}
JSON

cat > "$app_dir/parity.mjs" <<JS
import { checkScopedRouteTrees, formatParityDifferences } from "tanstack-router-scoped-trees";

const differences = await checkScopedRouteTrees();
const report = formatParityDifferences(differences);

if (differences.length > 0) {
  console.error(report);
  process.exit(1);
}

console.log("parity: no differences");
JS

cd "$app_dir"
npm install --no-audit --no-fund "$package_tarball" @tanstack/router-generator@latest
npx tanstack-router-scoped-trees init
npx tanstack-router-scoped-trees generate
npx tanstack-router-scoped-trees generate --check
node parity.mjs
