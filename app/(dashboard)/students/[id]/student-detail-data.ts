import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { ClassListItem, CourseListItem } from "@/lib/contracts/courses"
import type { ReceiptListItem } from "@/lib/contracts/finance"
import type { MakeupEntitlementItem } from "@/lib/contracts/makeup-entitlements"
import type { StudentDetail } from "@/lib/contracts/students"
import type { StudentWalletSummary } from "@/lib/contracts/student-wallet"
import {
  activeStudentCourses,
  toReceiptDraftLine,
  type ReceiptDraftLine
} from "./student-detail-utils"

export function useStudentDetailData({
  setEnrollmentCourseId,
  setReceiptLines,
  studentId,
  syncProfileForm
}: {
  setEnrollmentCourseId: Dispatch<SetStateAction<string>>
  setReceiptLines: Dispatch<SetStateAction<ReceiptDraftLine[]>>
  studentId: string
  syncProfileForm: (student: StudentDetail) => void
}) {
  const [student, setStudent] = useState<StudentDetail | null>(null)
  const [courses, setCourses] = useState<CourseListItem[]>([])
  const [classes, setClasses] = useState<ClassListItem[]>([])
  const [studentReceipts, setStudentReceipts] = useState<ReceiptListItem[]>([])
  const [studentWallet, setStudentWallet] = useState<StudentWalletSummary | null>(null)
  const [makeupEntitlements, setMakeupEntitlements] = useState<MakeupEntitlementItem[]>([])
  const [lastReceipt, setLastReceipt] = useState<ReceiptListItem | null>(null)
  const [photoCaptionDrafts, setPhotoCaptionDrafts] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadStudent() {
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}`, { cache: "no-store" })
      const payload = (await response.json()) as ApiResponse<StudentDetail>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tải được hồ sơ học viên.")
        return
      }

      const nextStudent = payload.data
      setStudent(nextStudent)
      setPhotoCaptionDrafts(Object.fromEntries(nextStudent.photos.map((photo) => [photo.id, photo.caption ?? ""])))
      syncProfileForm(nextStudent)
      setReceiptLines((current) => current.length ? current : activeStudentCourses(nextStudent).slice(0, 1).map(toReceiptDraftLine))
    } catch {
      setError("Không tải được hồ sơ học viên.")
    }
  }

  async function loadReceipts() {
    const response = await fetch(`/api/receipts?studentId=${studentId}`, { cache: "no-store" })
    const payload = (await response.json()) as ApiResponse<ReceiptListItem[]>

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error?.message ?? "Không tải được lịch sử phiếu thu.")
    }

    const receipts = payload.data
    setStudentReceipts(receipts)
    setLastReceipt((current) => current ?? receipts[0] ?? null)
  }

  async function loadFinanceLedger() {
    const [walletResponse, makeupResponse] = await Promise.all([
      fetch(`/api/student-wallet?studentId=${studentId}`, { cache: "no-store" }),
      fetch(`/api/makeup-entitlements?studentId=${studentId}`, { cache: "no-store" })
    ])
    const walletPayload = (await walletResponse.json()) as ApiResponse<StudentWalletSummary>
    const makeupPayload = (await makeupResponse.json()) as ApiResponse<MakeupEntitlementItem[]>

    setStudentWallet(walletResponse.ok && walletPayload.success && walletPayload.data ? walletPayload.data : null)
    setMakeupEntitlements(makeupResponse.ok && makeupPayload.success && makeupPayload.data ? makeupPayload.data : [])
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      setIsLoading(true)
      setError(null)

      try {
        const [studentResponse, coursesResponse, classesResponse, receiptsResponse, walletResponse, makeupResponse] = await Promise.all([
          fetch(`/api/students/${studentId}`, { cache: "no-store" }),
          fetch("/api/courses"),
          fetch("/api/classes?active=true&summary=true"),
          fetch(`/api/receipts?studentId=${studentId}`, { cache: "no-store" }),
          fetch(`/api/student-wallet?studentId=${studentId}`, { cache: "no-store" }),
          fetch(`/api/makeup-entitlements?studentId=${studentId}`, { cache: "no-store" })
        ])
        const studentPayload = (await studentResponse.json()) as ApiResponse<StudentDetail>
        const coursesPayload = (await coursesResponse.json()) as ApiResponse<CourseListItem[]>
        const classesPayload = (await classesResponse.json()) as ApiResponse<ClassListItem[]>
        const receiptsPayload = (await receiptsResponse.json()) as ApiResponse<ReceiptListItem[]>
        const walletPayload = (await walletResponse.json()) as ApiResponse<StudentWalletSummary>
        const makeupPayload = (await makeupResponse.json()) as ApiResponse<MakeupEntitlementItem[]>

        if (!isMounted) return

        if (!studentResponse.ok || !studentPayload.success || !studentPayload.data) {
          setError(studentPayload.error?.message ?? "Không tải được hồ sơ học viên.")
          return
        }

        const nextStudent = studentPayload.data
        setStudent(nextStudent)
        setPhotoCaptionDrafts(Object.fromEntries(nextStudent.photos.map((photo) => [photo.id, photo.caption ?? ""])))
        syncProfileForm(nextStudent)
        setReceiptLines((current) => current.length ? current : activeStudentCourses(nextStudent).slice(0, 1).map(toReceiptDraftLine))

        if (coursesPayload.success && coursesPayload.data) {
          setCourses(coursesPayload.data)
          setEnrollmentCourseId((current) => current || coursesPayload.data?.find((course) => course.isActive)?.id || "")
        }

        if (classesPayload.success && classesPayload.data) {
          setClasses(classesPayload.data)
        }

        if (receiptsPayload.success && receiptsPayload.data) {
          setStudentReceipts(receiptsPayload.data)
          setLastReceipt((current) => current ?? receiptsPayload.data?.[0] ?? null)
        }

        setStudentWallet(walletResponse.ok && walletPayload.success && walletPayload.data ? walletPayload.data : null)
        setMakeupEntitlements(makeupResponse.ok && makeupPayload.success && makeupPayload.data ? makeupPayload.data : [])
      } catch {
        if (isMounted) setError("Không tải được hồ sơ học viên.")
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void loadInitialData()

    return () => {
      isMounted = false
    }
  }, [setEnrollmentCourseId, setReceiptLines, studentId, syncProfileForm])

  return {
    classes,
    courses,
    error,
    isLoading,
    lastReceipt,
    loadFinanceLedger,
    loadReceipts,
    loadStudent,
    makeupEntitlements,
    photoCaptionDrafts,
    setError,
    setLastReceipt,
    setPhotoCaptionDrafts,
    setStudent,
    student,
    studentReceipts,
    studentWallet
  }
}
