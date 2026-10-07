import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
async function walk(dir) {
const out = [];
for (const item of await readdir(dir, { withFileTypes: true })) {
if (item.name === "generated") continue;
const file = path.join(dir, item.name);
if (item.isDirectory()) out.push(...await walk(file)); else if (/\.tsx?$/.test(file)) out.push(file);
}
return out;
}
const problems = [];
for (const file of await walk("src")) {
const source = await readFile(file, "utf8");
const domain = /[\\/](domain|contracts)[\\/]/.test(file);
const client = source.startsWith('"use client"') || source.startsWith("'use client'");
if (domain && /from\s+["'][^"']*(infrastructure|react|next|prisma|supabase)/.test(source)) problems.push(file + ": domain imports provider/UI");
if (client && /from\s+["'][^"']*(infrastructure|generated\/prisma|@prisma)/.test(source)) problems.push(file + ": client imports persistence");
}
if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; } else console.log("PASS: domain/provider and client/persistence import boundaries");
