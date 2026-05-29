import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const publicRoutes = ["/login", "/api/auth", "/api/health"]

export default auth((request) => {
  const { pathname } = request.nextUrl
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  if (isPublicRoute) {
    return NextResponse.next()
  }

  if (!request.auth) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Bạn cần đăng nhập."
          }
        },
        { status: 401 }
      )
    }

    const loginUrl = new URL("/login", request.nextUrl)
    return NextResponse.redirect(loginUrl)
  }

  const parentAllowedRoute = pathname.startsWith("/parent") || pathname.startsWith("/final-assessments/")

  if (request.auth.user.role === "PARENT" && !pathname.startsWith("/api") && !parentAllowedRoute) {
    return NextResponse.redirect(new URL("/parent", request.nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
}
