const fs = require("fs");
const path = require("path");

const roots = ["app", "components", "lib"].filter((root) => fs.existsSync(root));
const extensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const badChars = ["\uFFFD", "Ã", "Â", "Ð"];
const badWords = ["revisi?n", "aprobaci?n", "configuraci?n", "comunicaci?n", "contrase?a", "administraci?n"];
const matches = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!extensions.has(path.extname(entry.name))) continue;

    const content = fs.readFileSync(fullPath, "utf8");
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      const hasBadChar = badChars.some((char) => line.includes(char));
      const lower = line.toLowerCase();
      const hasBadWord = badWords.some((word) => lower.includes(word));
      if (hasBadChar || hasBadWord) {
        matches.push(`${fullPath}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

roots.forEach(walk);

if (matches.length > 0) {
  console.error("Broken characters detected:");
  for (const match of matches) console.error(match);
  process.exit(1);
}

console.log("Text encoding check passed.");