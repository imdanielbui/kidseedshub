import { spawnSync } from "child_process"
import { readFileSync } from "fs"

type PackageJson = {
  scripts?: Record<string, string>
}

type Step = {
  name: string
  command: string
  args: string[]
}

function runStep(step: Step) {
  console.log(`\n> ${step.name}`)
  const result = spawnSync(step.command, step.args, {
    env: process.env,
    stdio: "inherit"
  })

  if (result.error) {
    console.error(`Release preflight failed to run ${step.name}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`Release preflight failed at ${step.name}.`)
    process.exit(result.status ?? 1)
  }
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as PackageJson
const steps: Step[] = [
  { name: "Environment validation", command: "npm", args: ["run", "env:validate"] },
  { name: "TypeScript", command: "npm", args: ["run", "typecheck"] },
  { name: "ESLint", command: "npm", args: ["run", "lint"] },
  { name: "Prisma schema validation", command: "npx", args: ["prisma", "validate"] },
  { name: "Prisma migration status", command: "npx", args: ["prisma", "migrate", "status"] },
  { name: "Production dependency audit", command: "npm", args: ["audit", "--omit=dev", "--audit-level=high"] },
  { name: "Production build", command: "npm", args: ["run", "build"] }
]

if (packageJson.scripts?.test) {
  steps.splice(3, 0, { name: "Automated tests", command: "npm", args: ["run", "test"] })
} else {
  console.warn("Release preflight warning: package.json has no test script; document this release gap.")
}

for (const step of steps) {
  runStep(step)
}

console.log("\nRelease preflight passed.")
