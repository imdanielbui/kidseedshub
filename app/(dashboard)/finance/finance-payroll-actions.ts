import type { Dispatch, SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { PayrollLineItem, PayrollRunItem } from "@/lib/contracts/payroll"
import type { PayrollLineEditState } from "./finance-utils"

type SetState<T> = Dispatch<SetStateAction<T>>

export function useFinancePayrollActions({
  month,
  payrollLineEdits,
  setError,
  setIsCreatingPayroll,
  setPayrollActionId,
  setPayrollLineEdits,
  setRefreshKey
}: {
  month: string
  payrollLineEdits: Record<string, PayrollLineEditState>
  setError: SetState<string | null>
  setIsCreatingPayroll: SetState<boolean>
  setPayrollActionId: SetState<string>
  setPayrollLineEdits: SetState<Record<string, PayrollLineEditState>>
  setRefreshKey: SetState<number>
}) {
  const refresh = () => setRefreshKey((current) => current + 1)

  async function createPayrollRun() {
    setIsCreatingPayroll(true)
    setError(null)

    try {
      const response = await fetch("/api/payroll-runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ month })
      })
      const payload = (await response.json()) as ApiResponse<PayrollRunItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không tạo được kỳ payroll.")
        return
      }

      refresh()
    } catch {
      setError("Không tạo được kỳ payroll.")
    } finally {
      setIsCreatingPayroll(false)
    }
  }

  async function runPayrollAction(run: PayrollRunItem, action: "generate" | "approve" | "pay") {
    setPayrollActionId(`${run.id}:${action}`)
    setError(null)

    try {
      const response = await fetch(`/api/payroll-runs/${run.id}/${action}`, { method: "POST" })
      const payload = (await response.json()) as ApiResponse<PayrollRunItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không cập nhật được payroll.")
        return
      }

      setPayrollLineEdits({})
      refresh()
    } catch {
      setError("Không cập nhật được payroll.")
    } finally {
      setPayrollActionId("")
    }
  }

  async function savePayrollLine(run: PayrollRunItem, line: PayrollLineItem) {
    const edit = payrollLineEdits[line.id]

    if (!edit?.note.trim()) {
      setError("Điều chỉnh payroll cần ghi chú.")
      return
    }

    setPayrollActionId(`${run.id}:line:${line.id}`)
    setError(null)

    try {
      const response = await fetch(`/api/payroll-runs/${run.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: [{
            id: line.id,
            hoursWorked: edit.hoursWorked || line.hoursWorked,
            deductions: edit.deductions || line.deductions,
            adjustments: edit.adjustments || line.adjustments,
            note: edit.note.trim()
          }]
        })
      })
      const payload = (await response.json()) as ApiResponse<PayrollRunItem>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không lưu được dòng payroll.")
        return
      }

      setPayrollLineEdits((current) => {
        const next = { ...current }
        delete next[line.id]
        return next
      })
      refresh()
    } catch {
      setError("Không lưu được dòng payroll.")
    } finally {
      setPayrollActionId("")
    }
  }

  function updatePayrollLineEdit(line: PayrollLineItem, patch: Partial<PayrollLineEditState>) {
    setPayrollLineEdits((current) => ({
      ...current,
      [line.id]: {
        hoursWorked: current[line.id]?.hoursWorked ?? "",
        deductions: current[line.id]?.deductions ?? "",
        adjustments: current[line.id]?.adjustments ?? "",
        note: current[line.id]?.note ?? "",
        ...patch
      }
    }))
  }

  return { createPayrollRun, runPayrollAction, savePayrollLine, updatePayrollLineEdit }
}
