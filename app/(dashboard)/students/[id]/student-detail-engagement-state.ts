import { useMemo, useState, type Dispatch, type SetStateAction } from "react"
import type { ApiResponse } from "@/lib/api-response"
import type { ClassPhotoListItem } from "@/lib/contracts/classes"
import type { ContactResultKey } from "@/lib/contracts/crm"
import type { StudentContactLogItem, StudentDetail, StudentTaskItem } from "@/lib/contracts/students"
import type { PhotoReviewFilter } from "./student-detail-utils"

export function useStudentEngagementState({
  loadStudent,
  setError,
  setStudent,
  student,
  studentId
}: {
  loadStudent: () => Promise<void>
  setError: Dispatch<SetStateAction<string | null>>
  setStudent: Dispatch<SetStateAction<StudentDetail | null>>
  student: StudentDetail | null
  studentId: string
}) {
  const [content, setContent] = useState("")
  const [result, setResult] = useState<ContactResultKey>("INTERESTED")
  const [taskTitle, setTaskTitle] = useState("")
  const [taskNote, setTaskNote] = useState("")
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [photoReviewFilter, setPhotoReviewFilter] = useState<PhotoReviewFilter>("DRAFT")
  const [photoCourseFilter, setPhotoCourseFilter] = useState("ALL")
  const [photoDateFrom, setPhotoDateFrom] = useState("")
  const [photoDateTo, setPhotoDateTo] = useState("")
  const [photoSavingId, setPhotoSavingId] = useState<string | null>(null)
  const [isSubmittingLog, setIsSubmittingLog] = useState(false)
  const [isSubmittingTask, setIsSubmittingTask] = useState(false)
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null)
  const photoCourseOptions = useMemo(() => {
    const names = new Set((student?.photos ?? []).map((photo) => photo.courseName).filter(Boolean))
    return Array.from(names).sort() as string[]
  }, [student?.photos])
  const filteredPhotos = useMemo(() => {
    const fromTime = photoDateFrom ? new Date(`${photoDateFrom}T00:00:00`).getTime() : undefined
    const toTime = photoDateTo ? new Date(`${photoDateTo}T23:59:59`).getTime() : undefined

    return (student?.photos ?? []).filter((photo) => {
      const takenTime = new Date(photo.takenAt).getTime()
      const matchesStatus =
        photoReviewFilter === "ALL" ||
        (photoReviewFilter === "DRAFT" ? !photo.isPublished : photo.isPublished)
      const matchesCourse = photoCourseFilter === "ALL" || photo.courseName === photoCourseFilter
      const matchesFrom = fromTime === undefined || takenTime >= fromTime
      const matchesTo = toTime === undefined || takenTime <= toTime

      return matchesStatus && matchesCourse && matchesFrom && matchesTo
    })
  }, [photoCourseFilter, photoDateFrom, photoDateTo, photoReviewFilter, student?.photos])

  async function submitContactLog(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingLog(true)
    setError(null)

    try {
      const response = await fetch(`/api/students/${studentId}/contact-logs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          result
        })
      })
      const payload = (await response.json()) as ApiResponse<StudentContactLogItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không lưu được lịch sử liên hệ.")
        return
      }

      setStudent((current) => current ? { ...current, contactLogs: [payload.data as StudentContactLogItem, ...current.contactLogs] } : current)
      setContent("")
      setResult("INTERESTED")
    } catch {
      setError("Không lưu được lịch sử liên hệ.")
    } finally {
      setIsSubmittingLog(false)
    }
  }

  async function submitTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmittingTask(true)
    setError(null)

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          note: taskNote.trim() || undefined,
          dueDate: new Date(`${taskDueDate}T17:00:00`).toISOString(),
          studentId
        })
      })
      const payload = (await response.json()) as ApiResponse<StudentTaskItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không tạo được task.")
        return
      }

      setStudent((current) => current ? { ...current, tasks: [payload.data as StudentTaskItem, ...current.tasks] } : current)
      setTaskTitle("")
      setTaskNote("")
      setTaskDueDate(new Date().toISOString().slice(0, 10))
    } catch {
      setError("Không tạo được task.")
    } finally {
      setIsSubmittingTask(false)
    }
  }

  async function markTaskDone(taskId: string) {
    setSavingTaskId(taskId)
    setError(null)

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "DONE" })
      })
      const payload = (await response.json()) as ApiResponse<StudentTaskItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được task.")
        return
      }

      setStudent((current) => current ? { ...current, tasks: current.tasks.map((task) => (task.id === taskId ? (payload.data as StudentTaskItem) : task)) } : current)
    } catch {
      setError("Không cập nhật được task.")
    } finally {
      setSavingTaskId(null)
    }
  }

  async function patchStudentPhoto(photoId: string, body: { caption?: string | null; isFeatured?: boolean; isPublished?: boolean; markSent?: boolean }) {
    setPhotoSavingId(photoId)
    setError(null)

    try {
      const response = await fetch(`/api/class-photos/${photoId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      })
      const payload = (await response.json()) as ApiResponse<ClassPhotoListItem>

      if (!response.ok || !payload.success || !payload.data) {
        setError(payload.error?.message ?? "Không cập nhật được ảnh học viên.")
        return
      }

      await loadStudent()
    } catch {
      setError("Không cập nhật được ảnh học viên.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  async function deleteStudentPhoto(photoId: string) {
    if (!window.confirm("Xóa ảnh này khỏi hồ sơ học viên?")) return

    setPhotoSavingId(photoId)
    setError(null)

    try {
      const response = await fetch(`/api/class-photos/${photoId}`, { method: "DELETE" })
      const payload = (await response.json()) as ApiResponse<{ deleted: boolean }>

      if (!response.ok || !payload.success) {
        setError(payload.error?.message ?? "Không xóa được ảnh học viên.")
        return
      }

      await loadStudent()
    } catch {
      setError("Không xóa được ảnh học viên.")
    } finally {
      setPhotoSavingId(null)
    }
  }

  return {
    content,
    deleteStudentPhoto,
    filteredPhotos,
    isSubmittingLog,
    isSubmittingTask,
    markTaskDone,
    patchStudentPhoto,
    photoCourseFilter,
    photoCourseOptions,
    photoDateFrom,
    photoDateTo,
    photoReviewFilter,
    photoSavingId,
    result,
    savingTaskId,
    setContent,
    setPhotoCourseFilter,
    setPhotoDateFrom,
    setPhotoDateTo,
    setPhotoReviewFilter,
    setResult,
    setTaskDueDate,
    setTaskNote,
    setTaskTitle,
    submitContactLog,
    submitTask,
    taskDueDate,
    taskNote,
    taskTitle
  }
}
