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

generator_versions() {
  npm ls @tanstack/router-generator --all --json |
    node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{const v=new Set();const walk=(n)=>{for(const[k,c]of Object.entries(n.dependencies??{})){if(k==="@tanstack/router-generator")v.add(c.version);walk(c);}};walk(JSON.parse(s));console.log([...v].sort().join(" "));});'
}

cd "$app_dir"

pinned_generator() {
  node -p 'require("@tanstack/router-plugin/package.json").dependencies["@tanstack/router-generator"]'
}

# router-plugin pins one router-generator version, and npm installs a newer generator
# for this package's peer when the app has no direct dependency on it.
npm install --no-audit --no-fund "$package_tarball" \
  "@tanstack/router-plugin@${MISMATCH_ROUTER_PLUGIN_VERSION:-1.168.46}"

if npx tanstack-router-scoped-trees generate 2> mismatch.log; then
  echo "expected generate to fail with two router-generator versions installed" >&2
  exit 1
fi

grep -F "npm i -D @tanstack/router-generator@$(pinned_generator)" mismatch.log

npm install --no-audit --no-fund -D "@tanstack/router-plugin@${ROUTER_PLUGIN_VERSION:-latest}"
plugin_generator="$(pinned_generator)"
npm install --no-audit --no-fund -D "@tanstack/router-generator@$plugin_generator"

if [ "$(generator_versions)" != "$plugin_generator" ]; then
  echo "expected one @tanstack/router-generator ($plugin_generator), got: $(generator_versions)" >&2
  exit 1
fi

npx tanstack-router-scoped-trees init
npx tanstack-router-scoped-trees generate
npx tanstack-router-scoped-trees generate --check
node parity.mjs
