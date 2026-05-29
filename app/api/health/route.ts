import { ok } from "@/lib/api-response"

export function GET() {
  return ok({
    service: "kidseedshub",
    status: "ok"
  })
}
