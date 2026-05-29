import { NextResponse } from "next/server"

export type ApiError = {
  code: string
  message: string
}

export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: ApiError
  meta?: {
    total: number
    page: number
    limit: number
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<T>>({ success: true, data }, init)
}

export function fail(error: ApiError, init?: ResponseInit) {
  return NextResponse.json<ApiResponse<never>>({ success: false, error }, init)
}
