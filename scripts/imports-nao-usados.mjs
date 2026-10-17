// Lista imports nomeados que não são usados no arquivo (checagem rápida, sem ESLint)
import fs from "node:fs";
import path from "node:path";

const files = [];
const walk = dir =>
  fs.readdirSync(dir).forEach(name => {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (/\.jsx?$/.test(name)) {
      files.push(full);
    }
  });
walk("src");

let total = 0;
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const unused = [];
  for (const match of src.matchAll(/import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?\s*from\s*"[^"]+";/g)) {
    const names = [match[1], ...(match[2] ? match[2].split(",").map(part => part.trim().split(/\s+as\s+/).pop()) : [])].filter(Boolean);
    const body = src.replace(match[0], "");
    names.forEach(name => {
      const escaped = name.replace(/\$/g, "\\$");
      if (!new RegExp(`(^|[^\\w$])${escaped}([^\\w$]|$)`).test(body)) {
        unused.push(name);
      }
    });
  }
  if (unused.length) {
    total += unused.length;
    console.log(`${file}: ${unused.join(", ")}`);
  }
}
console.log(total ? `${total} import(s) sem uso` : "Nenhum import sem uso.");
