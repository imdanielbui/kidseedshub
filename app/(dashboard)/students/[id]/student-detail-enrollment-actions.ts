import type { Dispatch, FormEvent, SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { EnrollmentTransferResult } from "@/lib/contracts/enrollment-transfers"
import type { EnrollmentDeleteResult } from "@/lib/contracts/enrollments"
import type { CourseListItem } from "@/lib/contracts/courses"
import type { StudentDetail } from "@/lib/contracts/students"
import { toNonNegativeNumber } from "./student-detail-receipt-state"
import { toReceiptDraftLine, type EnrollmentEditDraft, type EnrollmentTransferDraft, type ReceiptDraftLine } from "./student-detail-utils"

export function useStudentEnrollmentActions({
  editingEnrollment,
  enrollmentClassId,
  enrollmentCourseId,
  enrollmentFreeTrialSessions,
  enrollmentSessions,
  enrollmentStartDate,
  loadFinanceLedger,
  loadStudent,
  selectedEnrollmentCourse,
  setEditingEnrollment,
  setEnrollmentClassId,
  setEnrollmentFreeTrialSessions,
  setEnrollmentSessions,
  setError,
  setIsConfirmingEnrollmentDelete,
  setIsDeletingEnrollment,
  setIsReceiptAmountOverride,
  setIsSubmittingEnrollment,
  setIsSubmittingTransfer,
  setIsUpdatingEnrollment,
  setIsWalletCreditManual,
  setReceiptAmount,
  setReceiptLines,
  setTransferDraft,
  studentId,
  transferDraft
}: {
  editingEnrollment: EnrollmentEditDraft | null
  enrollmentClassId: string
  enrollmentCourseId: string
  enrollmentFreeTrialSessions: string
  enrollmentSessions: string
  enrollmentStartDate: string
  loadFinanceLedger: () => Promise<void>
  loadStudent: () => Promise<void>
  selectedEnrollmentCourse?: CourseListItem
  setEditingEnrollment: Dispatch<SetStateAction<EnrollmentEditDraft | null>>
  setEnrollmentClassId: Dispatch<SetStateAction<string>>
  setEnrollmentFreeTrialSessions: Dispatch<SetStateAction<string>>
  setEnrollmentSessions: Dispatch<SetStateAction<string>>
  setError: Dispatch<SetStateAction<string | null>>
  setIsConfirmingEnrollmentDelete: Dispatch<SetStateAction<boolean>>
  setIsDeletingEnrollment: Dispatch<SetStateAction<boolean>>
  setIsReceiptAmountOverride: Dispatch<SetStateAction<boolean>>
  setIsSubmittingEnrollment: Dispatch<SetStateAction<boolean>>
  setIsSubmittingTransfer: Dispatch<SetStateAction<boolean>>
  setIsUpdatingEnrollment: Dispatch<SetStateAction<boolean>>
  setIsWalletCreditManual: Dispatch<SetStateAction<boolean>>
  setReceiptAmount: Dispatch<SetStateAction<string>>
  setReceiptLines: Dispatch<SetStateAction<ReceiptDraftLine[]>>
  setTransferDraft: Dispatch<SetStateAction<EnrollmentTransferDraft | null>>
  studentId: string
  transferDraft: EnrollmentTransferDraft | null
}) {
  function resetReceiptAfterEnrollmentChange() {
    setReceiptLines([])
    setReceiptAmount("")
    setIsReceiptAmountOverride(false)
  }

  async function submitEnrollment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingEnrollment(true)
    setError(null)

    try {
      const response = await fetch("/api/enrollments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          courseId: enrollmentCourseId,
          classId: enrollmentClassId || undefined,
          sessionsBought: toNonNegativeNumber(enrollmentSessions),
          totalCourseSessionsAtJoin: selectedEnrollmentCourse?.totalSessions,
          freeTrialSessions: toNonNegativeNumber(enrollmentFreeTrialSessions),
          startDate: new Date(`${enrollmentStartDate}T00:00:00`).toISOString()
        })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không ghi danh được khóa học.")
        return
      }

      setEnrollmentClassId("")
      setEnrollmentSessions("0")
      setEnrollmentFreeTrialSessions("0")
      await loadStudent()
    } catch {
      setError("Không ghi danh được khóa học.")
    } finally {
      setIsSubmittingEnrollment(false)
    }
  }

  async function submitEnrollmentEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingEnrollment) return

    const sessionsBought = toNonNegativeNumber(editingEnrollment.sessionsBought)
    const sessionsUsed = toNonNegativeNumber(editingEnrollment.sessionsUsed)

    if (sessionsUsed > sessionsBought) {
      setError("Số buổi đã học không được lớn hơn số buổi đã cấp.")
      return
    }

    setIsUpdatingEnrollment(true)
    setError(null)

    try {
      const response = await fetch(`/api/enrollments/${editingEnrollment.enrollmentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          classId: editingEnrollment.classId || null,
          sessionsBought,
          sessionsUsed,
          freeTrialSessions: toNonNegativeNumber(editingEnrollment.freeTrialSessions),
          startDate: editingEnrollment.startDate ? new Date(`${editingEnrollment.startDate}T00:00:00`).toISOString() : null,
          isActive: editingEnrollment.isActive
        })
      })
      const payload = (await response.json()) as ApiResponse<unknown>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không cập nhật được khóa đã đăng ký.")
        return
      }

      setEditingEnrollment(null)
      resetReceiptAfterEnrollmentChange()
      await loadStudent()
    } catch {
      setError("Không cập nhật được khóa đã đăng ký.")
    } finally {
      setIsUpdatingEnrollment(false)
    }
  }

  async function deleteOrCancelEnrollment() {
    if (!editingEnrollment) return

    setIsDeletingEnrollment(true)
    setError(null)

    try {
      const response = await fetch(`/api/enrollments/${editingEnrollment.enrollmentId}`, {
        method: "DELETE"
      })
      const payload = (await response.json()) as ApiResponse<EnrollmentDeleteResult>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không xóa hoặc hủy được ghi danh.")
        return
      }

      setEditingEnrollment(null)
      setIsConfirmingEnrollmentDelete(false)
      resetReceiptAfterEnrollmentChange()
      await loadStudent()
    } catch {
      setError("Không xóa hoặc hủy được ghi danh.")
    } finally {
      setIsDeletingEnrollment(false)
    }
  }

  function openTransferDialog(course: StudentDetail["courses"][number]) {
    setTransferDraft({
      fromEnrollmentId: course.enrollmentId,
      toCourseId: course.courseId,
      toClassId: "",
      startDate: new Date().toISOString().slice(0, 10),
      reason: ""
    })
  }

  async function submitTransfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!transferDraft) return

    if (!transferDraft.reason.trim()) {
      setError("Cần nhập lý do chuyển lớp/khóa.")
      return
    }

    setIsSubmittingTransfer(true)
    setError(null)

    try {
      const response = await fetch("/api/enrollment-transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fromEnrollmentId: transferDraft.fromEnrollmentId,
          toCourseId: transferDraft.toCourseId,
          toClassId: transferDraft.toClassId || undefined,
          startDate: transferDraft.startDate ? new Date(`${transferDraft.startDate}T00:00:00`).toISOString() : undefined,
          reason: transferDraft.reason.trim()
        })
      })
      const payload = (await response.json()) as ApiResponse<EnrollmentTransferResult>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không chuyển lớp/khóa được.")
        return
      }

      setTransferDraft(null)
      setReceiptAmount("")
      setIsReceiptAmountOverride(false)
      setIsWalletCreditManual(false)

      if (payload.data.isCourseTransfer) {
        setReceiptLines([toReceiptDraftLine(payload.data.enrollment)])
      }

      await loadStudent()
      await loadFinanceLedger()
    } catch {
      setError("Không chuyển lớp/khóa được.")
    } finally {
      setIsSubmittingTransfer(false)
    }
  }

  return {
    deleteOrCancelEnrollment,
    openTransferDialog,
    submitEnrollment,
    submitEnrollmentEdit,
    submitTransfer
  }
}
