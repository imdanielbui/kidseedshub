import { useEffect, useState } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { ClassListItem } from "@/lib/contracts/courses"
import type { ExpenseListItem, FinanceSummary, ReceiptListItem } from "@/lib/contracts/finance"
import type { PayrollRunItem } from "@/lib/contracts/payroll"
import type { TuitionReminderItem, ZaloTemplateItem } from "@/lib/contracts/reminders"
import type { StudentListItem } from "@/lib/contracts/students"
import type { FinanceRole, SessionPayload } from "./finance-utils"

export function useFinanceData({ month, refreshKey, selectedTemplateId }: { month: string; refreshKey: number; selectedTemplateId: string }) {
  const [sessionRole, setSessionRole] = useState<FinanceRole | null>(null)
  const [isLoadingSession, setIsLoadingSession] = useState(true)
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([])
  const [expenses, setExpenses] = useState<ExpenseListItem[]>([])
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunItem[]>([])
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [classes, setClasses] = useState<ClassListItem[]>([])
  const [templates, setTemplates] = useState<ZaloTemplateItem[]>([])
  const [reminders, setReminders] = useState<TuitionReminderItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = sessionRole === "ADMIN"
  const isSale = sessionRole === "SALE"
  const canUseFinance = isAdmin || isSale
  const canCreateReceipt = canUseFinance
  const canManageReminders = canUseFinance

  useEffect(() => {
    let isMounted = true
    void (async () => {
      setIsLoadingSession(true)
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" })
        const payload = (await response.json()) as SessionPayload
        if (isMounted) setSessionRole(payload?.user?.role ?? null)
      } catch {
        if (isMounted) setSessionRole(null)
      } finally {
        if (isMounted) setIsLoadingSession(false)
      }
    })()
    return () => { isMounted = false }
  }, [])

  useEffect(() => {
    if (isLoadingSession) return
    let isMounted = true
    void (async () => {
      if (!canUseFinance) {
        setSummary(null); setReceipts([]); setExpenses([]); setPayrollRuns([]); setTemplates([]); setReminders([]); setIsLoading(false)
        return
      }
      setIsLoading(true); setError(null)
      try {
        const [summaryResult, receiptsResult, expensesResult, payrollResult, templatesResult, remindersResult] = await Promise.all([
          isAdmin ? fetch(`/api/finance/summary?month=${month}`, { cache: "no-store" }).then(async response => ({ response, payload: await response.json() as ApiResponse<FinanceSummary> })) : Promise.resolve(null),
          fetch(`/api/receipts?month=${month}`, { cache: "no-store" }).then(async response => ({ response, payload: await response.json() as ApiResponse<ReceiptListItem[]> })),
          isAdmin ? fetch(`/api/expenses?month=${month}`, { cache: "no-store" }).then(async response => ({ response, payload: await response.json() as ApiResponse<ExpenseListItem[]> })) : Promise.resolve(null),
          isAdmin ? fetch(`/api/payroll-runs?month=${month}`, { cache: "no-store" }).then(async response => ({ response, payload: await response.json() as ApiResponse<PayrollRunItem[]> })) : Promise.resolve(null),
          canManageReminders ? fetch("/api/message-templates", { cache: "no-store" }).then(async response => ({ response, payload: await response.json() as ApiResponse<ZaloTemplateItem[]> })) : Promise.resolve(null),
          canManageReminders ? fetch(`/api/tuition-reminders?templateId=${selectedTemplateId}&billingMonth=${month}`, { cache: "no-store" }).then(async response => ({ response, payload: await response.json() as ApiResponse<TuitionReminderItem[]> })) : Promise.resolve(null)
        ])
        if (!isMounted) return
        setSummary(summaryResult?.response.ok && summaryResult.payload.success && summaryResult.payload.data ? summaryResult.payload.data : null)
        setReceipts(receiptsResult.response.ok && receiptsResult.payload.success && receiptsResult.payload.data ? receiptsResult.payload.data : [])
        setExpenses(expensesResult?.response.ok && expensesResult.payload.success && expensesResult.payload.data ? expensesResult.payload.data : [])
        setPayrollRuns(payrollResult?.response.ok && payrollResult.payload.success && payrollResult.payload.data ? payrollResult.payload.data : [])
        setTemplates(templatesResult?.response.ok && templatesResult.payload.success && templatesResult.payload.data ? templatesResult.payload.data : [])
        setReminders(remindersResult?.response.ok && remindersResult.payload.success && remindersResult.payload.data ? remindersResult.payload.data : [])
        const firstError = [summaryResult, receiptsResult, expensesResult, payrollResult, templatesResult, remindersResult].map(result => result?.payload.error).find(Boolean)
        if (firstError) setError(firstError.message)
      } catch { if (isMounted) setError("Không tải được dữ liệu tài chính.") }
      finally { if (isMounted) setIsLoading(false) }
    })()
    return () => { isMounted = false }
  }, [canManageReminders, canUseFinance, isAdmin, isLoadingSession, month, refreshKey, selectedTemplateId])

  useEffect(() => {
    if (!canCreateReceipt) return
    let isMounted = true
    void (async () => {
      try {
        const [studentsResponse, classesResponse] = await Promise.all([fetch("/api/students?limit=100", { cache: "no-store" }), fetch("/api/classes?active=true&summary=true", { cache: "no-store" })])
        const studentsPayload = (await studentsResponse.json()) as ApiResponse<StudentListItem[]>
        const classesPayload = (await classesResponse.json()) as ApiResponse<ClassListItem[]>
        if (isMounted && studentsResponse.ok && studentsPayload.success && studentsPayload.data) setStudents(studentsPayload.data)
        if (isMounted && classesResponse.ok && classesPayload.success && classesPayload.data) setClasses(classesPayload.data)
      } catch { if (isMounted) { setStudents([]); setClasses([]) } }
    })()
    return () => { isMounted = false }
  }, [canCreateReceipt])

  return { canCreateReceipt, canManageReminders, canUseFinance, classes, error, expenses, isAdmin, isLoading, isLoadingSession, isSale, payrollRuns, receipts, reminders, setError, students, summary, templates }
}
