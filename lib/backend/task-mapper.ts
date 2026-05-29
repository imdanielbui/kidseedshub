import { Prisma } from "@prisma/client"
import type { StudentTaskItem } from "@/lib/contracts/students"

export const taskInclude = Prisma.validator<Prisma.TaskInclude>()({
  student: true,
  assignedTo: true,
  createdBy: true
})

export type TaskRecord = Prisma.TaskGetPayload<{ include: typeof taskInclude }>

export function toTaskItem(task: TaskRecord): StudentTaskItem {
  return {
    id: task.id,
    title: task.title,
    note: task.note ?? undefined,
    status: task.status,
    studentName: task.student?.name,
    assignedToName: task.assignedTo.name,
    dueDate: task.dueDate.toISOString()
  }
}
