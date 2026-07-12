import type { Dispatch, SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { ParentAccountInfo, StudentDetail } from "@/lib/contracts/students"
import type { ParentAccountAction } from "./student-detail-utils"

export function useStudentParentAccountActions({
  setError,
  setIsUpdatingParentAccount,
  setStudent,
  setTemporaryParentPassword,
  studentId
}: {
  setError: Dispatch<SetStateAction<string | null>>
  setIsUpdatingParentAccount: Dispatch<SetStateAction<boolean>>
  setStudent: Dispatch<SetStateAction<StudentDetail | null>>
  setTemporaryParentPassword: Dispatch<SetStateAction<string | null>>
  studentId: string
}) {
  async function updateParentAccount(action: ParentAccountAction) {
    setIsUpdatingParentAccount(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}/parent-account`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      })
      const payload = (await response.json()) as ApiResponse<ParentAccountInfo>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được tài khoản phụ huynh.")
        return
      }

      setStudent((current) => current ? { ...current, parentAccount: payload.data as ParentAccountInfo } : current)
      setTemporaryParentPassword(payload.data.temporaryPassword ?? null)
    } catch {
      setError("Không cập nhật được tài khoản phụ huynh.")
    } finally {
      setIsUpdatingParentAccount(false)
    }
  }

  return { updateParentAccount }
}
