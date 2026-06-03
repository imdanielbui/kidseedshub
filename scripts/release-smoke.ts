type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

type HealthPayload = {
  service: string
  status: string
}

const baseUrl = process.env.KIDSEEDSHUB_RELEASE_URL ?? "http://localhost:3000"
const expectProductionUi = process.env.KIDSEEDSHUB_EXPECT_PRODUCTION_UI === "true"
const demoMarkers = ["Tai khoan demo", "Tài khoản demo", "Admin@123", "Sale@123", "Teacher@123", "Parent@123"]

function url(path: string) {
  return new URL(path, baseUrl).toString()
}

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message)
  }
}

async function checkHealth() {
  const response = await fetch(url("/api/health"), { redirect: "manual" })
  assert(response.status === 200, `/api/health expected 200, got ${response.status}`)
  const payload = (await response.json()) as ApiResponse<HealthPayload>
  assert(payload.success && payload.data?.service === "kidseedshub" && payload.data.status === "ok", "/api/health returned unexpected payload")
}

async function checkLoginPage() {
  const response = await fetch(url("/login"), { redirect: "manual" })
  assert(response.status === 200, `/login expected 200, got ${response.status}`)

  if (!expectProductionUi) {
    return
  }

  const html = await response.text()
  const visibleMarker = demoMarkers.find((marker) => html.includes(marker))
  assert(!visibleMarker, `/login still contains demo marker '${visibleMarker}' while KIDSEEDSHUB_EXPECT_PRODUCTION_UI=true`)
}

async function checkProtectedPageRedirect() {
  const response = await fetch(url("/dashboard"), { redirect: "manual" })
  assert([302, 303, 307, 308].includes(response.status), `/dashboard expected auth redirect, got ${response.status}`)
  assert(response.headers.get("location")?.includes("/login"), "/dashboard redirect target should include /login")
}

async function checkProtectedApi() {
  const response = await fetch(url("/api/students"), { redirect: "manual" })
  assert(response.status === 401, `/api/students expected 401 without session, got ${response.status}`)
  const payload = (await response.json()) as ApiResponse<never>
  assert(!payload.success && payload.error?.code === "UNAUTHORIZED", "/api/students returned unexpected unauthorized payload")
}

async function main() {
  console.log(`Running release smoke against ${baseUrl}`)
  await checkHealth()
  await checkLoginPage()
  await checkProtectedPageRedirect()
  await checkProtectedApi()
  console.log("Release smoke passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
