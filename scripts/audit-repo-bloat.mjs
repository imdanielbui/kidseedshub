#!/usr/bin/env node
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

const ignoredDirs = new Set([
  ".git",
  ".gitnexus",
  ".next",
  ".playwright-cli",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "output",
  "public/uploads",
])

const generatedPathPrefixes = [
  ".gitnexus/",
  ".next/",
  ".playwright-cli/",
  "coverage/",
  "dist/",
  "node_modules/",
  "out/",
  "output/",
  "public/uploads/",
]

const textExtensions = new Set([
  ".css",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mjs",
  ".prisma",
  ".ts",
  ".tsx",
])

const ignoredFiles = new Set([
  "package-lock.json",
])

const lineTargets = [
  { match: (file) => file.endsWith(".tsx"), target: 800 },
  { match: (file) => file.endsWith("route.ts"), target: 450 },
  { match: (file) => file.endsWith(".ts"), target: 600 },
  { match: (file) => file.endsWith(".md"), target: 350 },
  { match: (file) => file.endsWith(".prisma"), target: 700 },
]

const legacyLargeFiles = new Map([
  ["app/(dashboard)/students/[id]/student-detail-client.tsx", "legacy student profile workspace; split by tabs when touched"],
  ["app/(dashboard)/classes/class-schedule-board.tsx", "legacy class schedule board; split calendar, attendance, and photo workflows when touched"],
  ["app/(dashboard)/finance/page.tsx", "legacy finance workspace; split receipt workflow and tabs when touched"],
  ["app/(dashboard)/assessments/page.tsx", "legacy assessments workspace; split assessment workflows when touched"],
  ["app/(dashboard)/pipeline/page.tsx", "legacy pipeline workspace; split table, kanban, filters, and dialog when touched"],
  ["app/(dashboard)/classes/page.tsx", "legacy classes page; split class management, today view, and settings when touched"],
  ["prisma/seed.ts", "legacy seed script; split demo data builders when touched"],
  ["scripts/import-real-members.ts", "one-off import utility; move to scripts/imports/one-off after production import is complete"],
  ["docs/handoffs/kidseedshub-2026-05-13-handoff.md", "historical handoff; archive after active references are extracted"],
  ["prisma/schema.prisma", "current database schema; split only if Prisma supports the target structure safely"],
  ["app/globals.css", "current global stylesheet; extract component styles when touching related UI"],
  ["app/api/receipts/route.ts", "legacy receipt API; split validation/domain helpers when touching receipts"],
  ["AGENTS.md", "global agent contract; shrink only after module context files are in place"],
  ["docs/specs/ship-readiness-remediation-plan.md", "historical release plan; archive after active release gates are moved to checklists"],
])

function toRelative(file) {
  return path.relative(root, file).split(path.sep).join("/")
}

function shouldSkipDir(relativePath) {
  if (!relativePath) return false
  if (ignoredDirs.has(relativePath)) return true
  return [...ignoredDirs].some((dir) => relativePath.startsWith(`${dir}/`))
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = toRelative(fullPath)
    if (entry.isDirectory()) {
      if (!shouldSkipDir(relativePath)) walk(fullPath, files)
      continue
    }
    files.push(relativePath)
  }
  return files
}

function getTrackedFiles() {
  try {
    return execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter(Boolean)
  } catch {
    return []
  }
}

function countLines(relativePath) {
  const fullPath = path.join(root, relativePath)
  const content = readFileSync(fullPath, "utf8")
  if (!content) return 0
  return content.split("\n").length
}

function targetFor(file) {
  return lineTargets.find((item) => item.match(file))?.target ?? 500
}

const trackedFiles = getTrackedFiles()
const trackedGenerated = trackedFiles.filter((file) =>
  generatedPathPrefixes.some((prefix) => file.startsWith(prefix)),
)

const allFiles = walk(root)
const activeTextFiles = allFiles.filter((file) => textExtensions.has(path.extname(file)) && !ignoredFiles.has(file))

const largeFiles = []
for (const file of activeTextFiles) {
  const lines = countLines(file)
  const target = targetFor(file)
  if (lines > target) {
    largeFiles.push({
      file,
      lines,
      target,
      allowed: legacyLargeFiles.has(file),
      reason: legacyLargeFiles.get(file),
    })
  }
}

largeFiles.sort((a, b) => b.lines - a.lines)

const generatedDirsPresent = [...ignoredDirs]
  .filter((dir) => ![".git", "node_modules"].includes(dir))
  .filter((dir) => existsSync(path.join(root, dir)))
  .map((dir) => {
    const stats = statSync(path.join(root, dir))
    return { dir, isDirectory: stats.isDirectory() }
  })

const unapprovedLargeFiles = largeFiles.filter((item) => !item.allowed)
const hasBlockers = trackedGenerated.length > 0 || unapprovedLargeFiles.length > 0

console.log("Repo bloat audit")
console.log(`- Active text files scanned: ${activeTextFiles.length}`)
console.log(`- Generated/cache paths present: ${generatedDirsPresent.map((item) => item.dir).join(", ") || "none"}`)
console.log(`- Tracked generated artifacts: ${trackedGenerated.length}`)
console.log(`- Oversized active files: ${largeFiles.length}`)

if (trackedGenerated.length > 0) {
  console.log("\nTracked generated artifacts must be removed from git:")
  for (const file of trackedGenerated.slice(0, 30)) {
    console.log(`- ${file}`)
  }
}

if (largeFiles.length > 0) {
  console.log("\nOversized active files:")
  for (const item of largeFiles.slice(0, 30)) {
    const status = item.allowed ? "legacy allowed" : "blocked"
    const reason = item.reason ? ` - ${item.reason}` : ""
    console.log(`- ${item.file}: ${item.lines} lines (target ${item.target}) [${status}]${reason}`)
  }
}

if (hasBlockers) {
  console.log("\nAudit failed. Archive generated artifacts or split/allowlist oversized active files with a reason.")
  process.exit(1)
}

console.log("\nAudit passed. Existing large files are documented legacy split candidates.")
