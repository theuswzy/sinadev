import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];
const exists = (path) => existsSync(join(root, path));
const fail = (message) => errors.push(message);
const warn = (message) => warnings.push(message);

const required = [
  "src/router.tsx", "src/routeTree.gen.ts", "src/routes/__root.tsx",
  "src/routes/auth.tsx", "src/routes/auth-continue.tsx",
  "src/routes/_authenticated/route.tsx", "src/routes/_authenticated/aluno.tsx",
  "src/routes/_authenticated/professor.tsx", "src/routes/_authenticated/admin.tsx",
  "src/routes/_authenticated/perfil.tsx", "src/lib/sina-data.ts",
  "src/components/student-module-page.tsx", "src/components/admin-academic-setup.tsx",
  ".github/workflows/ci.yml",
];
for (const path of required) if (!exists(path)) fail("Arquivo obrigatório ausente: " + path);

if (exists("routes")) {
  const legacy = [];
  const walk = (dir) => {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path); else legacy.push(path);
    }
  };
  walk("routes");
  if (legacy.length) fail("Árvore de rotas legada fora de src/routes: " + legacy.join(", "));
}

const migrationDir = join(root, "supabase/migrations");
if (existsSync(migrationDir)) {
  const files = readdirSync(migrationDir).filter((name) => name.endsWith(".sql"));
  const versions = new Map();
  for (const file of files) {
    const match = file.match(/^(\\d{14})_/);
    if (!match) { warn("Migration sem versão timestamp padrão: " + file); continue; }
    const version = match[1];
    if (versions.has(version)) fail("Versão de migration duplicada " + version + ": " + versions.get(version) + " e " + file);
    versions.set(version, file);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
for (const script of ["build", "typecheck", "lint", "audit:static"]) if (!packageJson.scripts?.[script]) fail("Script obrigatório ausente no package.json: " + script);

const routeTree = readFileSync(join(root, "src/routeTree.gen.ts"), "utf8");
for (const route of ["/aluno", "/professor", "/admin", "/perfil", "/auth-continue"]) if (!routeTree.includes(route)) warn("Rota não encontrada literalmente no routeTree gerado: " + route);

console.log("\\nSINA static audit\\n=================");
for (const warning of warnings) console.log("⚠ " + warning);
for (const error of errors) console.error("✖ " + error);
console.log("\\nResultado: " + (errors.length ? "FALHOU" : "OK") + " — " + errors.length + " erro(s), " + warnings.length + " aviso(s).");
if (errors.length) process.exit(1);