#!/usr/bin/env node
/**
 * Recursively runs `node --check` on every .js file under the current
 * directory, skipping node_modules.  Exit code 1 on first failure.
 */
const { execSync } = require("child_process");
const { readdirSync, statSync } = require("fs");
const { join } = require("path");

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (full.endsWith(".js")) files.push(full);
  }
  return files;
}

const files = walk(".");
let ok = 0;
for (const f of files) {
  try {
    execSync(`node --check ${JSON.stringify(f)}`, { stdio: "inherit" });
    ok++;
  } catch {
    process.exit(1);
  }
}
console.log(`✅ All ${ok} files passed syntax check.`);
