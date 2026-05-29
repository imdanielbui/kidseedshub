import bcrypt from "bcryptjs"
import { PrismaClient, type ContactResult, type CourseSubject, type ExpenseCategory, type PaymentMethod, type ProgressLevel, type StudentStatus } from "@prisma/client"
import { nextStudentCode } from "../lib/backend/codes"
import { ensureVietnamPublicHolidays } from "../lib/backend/vietnam-public-holidays"
import { FUN_RUBRIC, ROBOTICS_RUBRIC, type AssessmentRubric } from "../lib/assessment-rubrics"

const prisma = new PrismaClient()

const today = new Date()
const todayWeekday = today.getDay()
const staleDate = daysAgo(5)

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(9, 0, 0, 0)
  return date
}

function dayAt(hour: number, minute = 0) {
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return date
}

function startOfDay(date: Date) {
  const value = new Date(date)
  value.setHours(0, 0, 0, 0)
  return value
}

function nextDateForWeekday(startDate: Date, weekday: number) {
  const date = startOfDay(startDate)
  const delta = (weekday - date.getDay() + 7) % 7
  date.setDate(date.getDate() + delta)
  return date
}

async function upsertUser(input: {
  name: string
  phone: string
  email: string
  password: string
  role: "ADMIN" | "SALE" | "TEACHER" | "PARENT"
}) {
  const password = await bcrypt.hash(input.password, 10)

  return prisma.user.upsert({
    where: { phone: input.phone },
    update: {
      name: input.name,
      email: input.email,
      password,
      role: input.role,
      isActive: true
    },
    create: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      password,
      role: input.role,
      isActive: true
    }
  })
}

async function upsertParent(input: { name: string; phone: string; email: string }) {
  const user = await upsertUser({
    ...input,
    password: "Parent@123",
    role: "PARENT"
  })

  return prisma.parent.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
    include: { user: true }
  })
}

async function upsertCourse(input: {
  name: string
  subject: CourseSubject
  totalSessions: number
  price: number
  description: string
}) {
  const existing = await prisma.course.findFirst({ where: { name: input.name } })

  if (existing) {
    return prisma.course.update({
      where: { id: existing.id },
      data: {
        subject: input.subject,
        totalSessions: input.totalSessions,
        price: input.price,
        description: input.description,
        isActive: true
      }
    })
  }

  return prisma.course.create({ data: input })
}

async function upsertStudent(input: {
  name: string
  birthDate: Date
  parentId: string
  status: StudentStatus
  leadSource: string
  leadNote: string
  healthNote?: string
  assignedTeacherId?: string
  createdAt?: Date
  updatedAt?: Date
}) {
  const existing = await prisma.student.findFirst({
    where: {
      name: input.name,
      parentId: input.parentId
    }
  })

  const data = {
    birthDate: input.birthDate,
    status: input.status,
    stageChangedAt: input.updatedAt ?? input.createdAt ?? new Date(),
    leadSource: input.leadSource,
    leadNote: input.leadNote,
    healthNote: input.healthNote,
    assignedTeacherId: input.assignedTeacherId,
    updatedAt: input.updatedAt
  }

  if (existing) {
    return prisma.student.update({
      where: { id: existing.id },
      data
    })
  }

  return prisma.student.create({
    data: {
      code: await nextStudentCode(prisma, input.createdAt ?? new Date()),
      name: input.name,
      parentId: input.parentId,
      createdAt: input.createdAt,
      ...data
    }
  })
}

async function upsertEnrollment(input: {
  studentId: string
  courseId: string
  sessionsBought: number
  sessionsUsed: number
  isActive?: boolean
  startDate?: Date
}) {
  const existing = await prisma.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      courseId: input.courseId
    }
  })

  const data = {
    sessionsBought: input.sessionsBought,
    sessionsUsed: input.sessionsUsed,
    isActive: input.isActive ?? true,
    startDate: input.startDate ?? daysAgo(20)
  }

  if (existing) {
    return prisma.enrollment.update({
      where: { id: existing.id },
      data
    })
  }

  return prisma.enrollment.create({
    data: {
      studentId: input.studentId,
      courseId: input.courseId,
      ...data
    }
  })
}

async function upsertClass(input: {
  name: string
  courseId: string
  teacherId: string
  weekday: number
  startTime: string
  endTime: string
  room: string
}) {
  const existing = await prisma.class.findFirst({ where: { name: input.name } })
  const course = await prisma.course.findUniqueOrThrow({ where: { id: input.courseId } })

  const klass = existing
    ? await prisma.class.update({
      where: { id: existing.id },
      data: {
        courseId: input.courseId,
        teacherId: input.teacherId,
        weekday: input.weekday,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
        startDate: startOfDay(today),
        plannedSessions: course.totalSessions,
        isActive: true
      }
    })
    : await prisma.class.create({
        data: {
          ...input,
          startDate: startOfDay(today),
          plannedSessions: course.totalSessions
        }
      })

  await syncClassSchedule(klass.id, {
    weekday: input.weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room,
    plannedSessions: course.totalSessions
  })

  return klass
}

async function syncClassSchedule(
  classId: string,
  input: {
    weekday: number
    startTime: string
    endTime: string
    room: string
    plannedSessions: number
  }
) {
  await prisma.classScheduleSlot.deleteMany({ where: { classId } })
  await prisma.classSession.deleteMany({
    where: {
      classId,
      attendances: { none: {} }
    }
  })

  const slot = await prisma.classScheduleSlot.create({
    data: {
      classId,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room
    }
  })

  const date = nextDateForWeekday(today, input.weekday)

  for (let index = 0; index < input.plannedSessions; index += 1) {
    const sessionDate = startOfDay(date)
    await prisma.classSession.upsert({
      where: {
        classId_date: {
          classId,
          date: sessionDate
        }
      },
      update: {
        scheduleSlotId: slot.id,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
        status: "SCHEDULED"
      },
      create: {
        classId,
        scheduleSlotId: slot.id,
        date: sessionDate,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
        status: "SCHEDULED"
      }
    })
    date.setDate(date.getDate() + 7)
  }
}

async function upsertClassStudent(classId: string, studentId: string) {
  return prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId,
        studentId
      }
    },
    update: { isActive: true },
    create: {
      classId,
      studentId,
      isActive: true
    }
  })
}

async function upsertClassSession(classId: string, topic: string) {
  const date = startOfDay(today)

  return prisma.classSession.upsert({
    where: {
      classId_date: {
        classId,
        date
      }
    },
    update: { topic },
    create: {
      classId,
      date,
      startTime: "09:00",
      endTime: "10:30",
      topic
    }
  })
}

async function upsertReceipt(input: {
  code: string
  enrollmentId: string
  amount: number
  sessions: number
  method: PaymentMethod
  note: string
  createdById: string
  createdAt?: Date
}) {
  return prisma.receipt.upsert({
    where: { code: input.code },
    update: {
      enrollmentId: input.enrollmentId,
      amount: input.amount,
      sessions: input.sessions,
      method: input.method,
      note: input.note,
      createdById: input.createdById,
      createdAt: input.createdAt
    },
    create: input
  })
}

async function upsertExpense(input: {
  code: string
  category: ExpenseCategory
  amount: number
  description: string
  date: Date
  createdById: string
  invoiceUrl?: string
}) {
  return prisma.expense.upsert({
    where: { code: input.code },
    update: input,
    create: input
  })
}

async function upsertTask(input: {
  title: string
  dueDate: Date
  studentId?: string
  assignedToId: string
  createdById: string
  note: string
}) {
  const existing = await prisma.task.findFirst({
    where: {
      title: input.title,
      studentId: input.studentId
    }
  })

  if (existing) {
    return prisma.task.update({
      where: { id: existing.id },
      data: {
        dueDate: input.dueDate,
        assignedToId: input.assignedToId,
        createdById: input.createdById,
        note: input.note,
        status: "PENDING",
        completedAt: null
      }
    })
  }

  return prisma.task.create({ data: input })
}

async function createContactLogIfMissing(input: {
  studentId: string
  loggedById: string
  content: string
  result: ContactResult
  createdAt: Date
}) {
  const existing = await prisma.contactLog.findFirst({
    where: {
      studentId: input.studentId,
      content: input.content
    }
  })

  if (!existing) {
    await prisma.contactLog.create({ data: input })
  }
}

function rubricItems(rubric: AssessmentRubric, mode: "complete" | "partial") {
  const levels: ProgressLevel[] = ["BEGINNING", "PROGRESSING", "PROFICIENT"]
  let index = 0

  return rubric.domains.flatMap((domain) =>
    domain.skills.flatMap((skill) =>
      skill.outcomes.map((_, outcomeIndex) => {
        const checked = mode === "complete" || index % 3 !== 0
        const progressLevel = levels[index % levels.length]
        index += 1

        return {
          domainKey: domain.key,
          skillKey: skill.key,
          outcomeIndex,
          checked,
          progressLevel,
          ...(rubric.subject === "ROBOTICS" ? { score: checked ? (progressLevel === "PROFICIENT" ? 5 : progressLevel === "PROGRESSING" ? 3 : 1) : undefined } : {}),
          comment: checked ? "Quan sát tốt trong buổi học." : "Cần tiếp tục theo dõi."
        }
      })
    )
  )
}

async function upsertRubricConfig(input: {
  rubric: AssessmentRubric
  createdById: string
}) {
  return prisma.$transaction(async (tx) => {
    const config = await tx.assessmentRubricConfig.upsert({
      where: {
        subject_version: {
          subject: input.rubric.subject,
          version: input.rubric.version
        }
      },
      update: {
        status: "ACTIVE",
        domainsJson: input.rubric.domains,
        createdById: input.createdById,
        activatedAt: new Date()
      },
      create: {
        subject: input.rubric.subject,
        version: input.rubric.version,
        status: "ACTIVE",
        domainsJson: input.rubric.domains,
        createdById: input.createdById,
        activatedAt: new Date()
      }
    })

    await tx.assessmentRubricConfig.updateMany({
      where: {
        subject: input.rubric.subject,
        status: "ACTIVE",
        id: { not: config.id }
      },
      data: { status: "ARCHIVED" }
    })

    return config
  })
}

async function upsertWeeklyAssessment(input: {
  studentId: string
  enrollmentId: string
  subject: CourseSubject
  rubricVersion: string
  weekNumber: number
  teacherId: string
  mode: "complete" | "partial"
  comment: string
  rubric: AssessmentRubric
}) {
  const items = rubricItems(input.rubric, input.mode)
  const status = items.every((item) => item.checked) ? "COMPLETE" : "IN_PROGRESS"
  const rubricConfig = await prisma.assessmentRubricConfig.findUnique({
    where: {
      subject_version: {
        subject: input.subject,
        version: input.rubricVersion
      }
    }
  })
  const rubricSnapshot = {
    subject: input.subject,
    version: input.rubricVersion,
    domains: input.rubric.domains
  }

  return prisma.weeklyAssessment.upsert({
    where: {
      enrollmentId_weekNumber_subject: {
        enrollmentId: input.enrollmentId,
        weekNumber: input.weekNumber,
        subject: input.subject
      }
    },
    update: {
      rubricVersion: input.rubricVersion,
      rubricConfigId: rubricConfig?.id,
      rubricSnapshot,
      status,
      teacherId: input.teacherId,
      comment: input.comment,
      items: {
        deleteMany: {},
        create: items
      }
    },
    create: {
      studentId: input.studentId,
      enrollmentId: input.enrollmentId,
      subject: input.subject,
      rubricVersion: input.rubricVersion,
      rubricConfigId: rubricConfig?.id,
      rubricSnapshot,
      weekNumber: input.weekNumber,
      status,
      teacherId: input.teacherId,
      comment: input.comment,
      items: {
        create: items
      }
    }
  })
}

async function upsertFinalAssessment(input: {
  studentId: string
  enrollmentId: string
  subject: CourseSubject
  rubricVersion: string
  requiredWeeks: number
  completedWeeks: number
  teacherId: string
}) {
  const existing = await prisma.finalAssessment.findFirst({
    where: {
      enrollmentId: input.enrollmentId,
      subject: input.subject
    }
  })

  const data = {
    studentId: input.studentId,
    enrollmentId: input.enrollmentId,
    subject: input.subject,
    rubricVersion: input.rubricVersion,
    requiredWeeks: input.requiredWeeks,
    completedWeeks: input.completedWeeks,
    strengths: "Tự tin tham gia hoạt động nhóm, biết trình bày sản phẩm.",
    improvements: "Cần luyện thêm việc giải thích lựa chọn và tự đánh giá sau hoạt động.",
    teacherSummary: "Học viên hoàn thành tốt mục tiêu khóa học giả định trong seed data.",
    nextSteps: "Tiếp tục lên lớp Robotics nâng cao hoặc FUN communication.",
    teacherId: input.teacherId,
    status: "PUBLISHED" as const,
    publishedAt: new Date(),
    publishedById: input.teacherId
  }

  if (existing) {
    return prisma.finalAssessment.update({
      where: { id: existing.id },
      data
    })
  }

  return prisma.finalAssessment.create({ data })
}

async function upsertTodayAttendance(input: {
  enrollmentId: string
  classSessionId: string
  status: "PRESENT" | "ABSENT_EXCUSED" | "ABSENT_NO_EXCUSE"
  markedById: string
  note: string
}) {
  const date = dayAt(9)
  const existing = await prisma.attendance.findFirst({
    where: {
      enrollmentId: input.enrollmentId,
      date: {
        gte: startOfDay(date),
        lt: new Date(startOfDay(date).getTime() + 24 * 60 * 60 * 1000)
      }
    }
  })

  if (existing) {
    return prisma.attendance.update({
      where: { id: existing.id },
      data: {
        classSessionId: input.classSessionId,
        status: input.status,
        markedById: input.markedById,
        note: input.note
      }
    })
  }

  return prisma.attendance.create({
    data: {
      enrollmentId: input.enrollmentId,
      classSessionId: input.classSessionId,
      date,
      status: input.status,
      markedById: input.markedById,
      note: input.note
    }
  })
}

async function main() {
  const admin = await upsertUser({
    name: "Admin Kid Seeds",
    phone: "0900000001",
    email: "admin@kidseeds.vn",
    password: "Admin@123",
    role: "ADMIN"
  })
  const sale = await upsertUser({
    name: "Sale Kid Seeds",
    phone: "0900000002",
    email: "sale@kidseeds.vn",
    password: "Sale@123",
    role: "SALE"
  })
  const teacherRobotics = await upsertUser({
    name: "Teacher Robotics",
    phone: "0900000003",
    email: "robotics.teacher@kidseeds.vn",
    password: "Teacher@123",
    role: "TEACHER"
  })
  const teacherFun = await upsertUser({
    name: "Teacher FUN",
    phone: "0900000005",
    email: "fun.teacher@kidseeds.vn",
    password: "Teacher@123",
    role: "TEACHER"
  })

  await Promise.all([
    upsertRubricConfig({ rubric: FUN_RUBRIC, createdById: admin.id }),
    upsertRubricConfig({ rubric: ROBOTICS_RUBRIC, createdById: admin.id })
  ])

  const [parentHoa, parentMinh, parentTrang, parentLan, parentQuang, parentMai] = await Promise.all([
    upsertParent({ name: "Chị Hoa", phone: "0911000001", email: "hoa.parent@example.com" }),
    upsertParent({ name: "Anh Minh", phone: "0911000002", email: "minh.parent@example.com" }),
    upsertParent({ name: "Chị Trang", phone: "0911000003", email: "trang.parent@example.com" }),
    upsertParent({ name: "Chị Lan", phone: "0911000004", email: "lan.parent@example.com" }),
    upsertParent({ name: "Anh Quang", phone: "0911000005", email: "quang.parent@example.com" }),
    upsertParent({ name: "Chị Mai", phone: "0911000006", email: "mai.parent@example.com" })
  ])

  const [roboticsBasic, roboticsAdvanced, funExplorers] = await Promise.all([
    upsertCourse({
      name: "Robotics Cơ bản",
      subject: "ROBOTICS",
      totalSessions: 12,
      price: 3000000,
      description: "Khóa Robotics nền tảng cho học viên mới."
    }),
    upsertCourse({
      name: "Robotics Nâng cao",
      subject: "ROBOTICS",
      totalSessions: 16,
      price: 4200000,
      description: "Khóa Robotics nâng cao sau khi hoàn thành cơ bản."
    }),
    upsertCourse({
      name: "FUN Explorers",
      subject: "FUN",
      totalSessions: 12,
      price: 2500000,
      description: "Khóa FUN phát triển giao tiếp, tư duy và sáng tạo."
    }),
    upsertCourse({
      name: "FUN Communication",
      subject: "FUN",
      totalSessions: 10,
      price: 2200000,
      description: "Khóa FUN tập trung vào giao tiếp và tự tin trình bày."
    })
  ])

  const studentAn = await upsertStudent({
    name: "Nguyễn Minh An",
    birthDate: new Date("2019-05-10"),
    parentId: parentHoa.id,
    status: "ACTIVE",
    leadSource: "Facebook Ads",
    leadNote: "Thích lắp ráp robot và đã đóng học phí Robotics.",
    healthNote: "Dễ mất tập trung sau 60 phút.",
    assignedTeacherId: teacherRobotics.id
  })
  const studentNgoc = await upsertStudent({
    name: "Trần Bảo Ngọc",
    birthDate: new Date("2020-02-20"),
    parentId: parentMinh.id,
    status: "TRIAL",
    leadSource: "Referral",
    leadNote: "Đã học thử FUN, cần sale follow-up.",
    assignedTeacherId: teacherFun.id,
    createdAt: staleDate,
    updatedAt: staleDate
  })
  const studentNam = await upsertStudent({
    name: "Lê Hoàng Nam",
    birthDate: new Date("2018-11-12"),
    parentId: parentTrang.id,
    status: "RETENTION",
    leadSource: "Walk-in",
    leadNote: "Sắp hết buổi Robotics, cần tư vấn gia hạn.",
    assignedTeacherId: teacherRobotics.id
  })
  const studentVy = await upsertStudent({
    name: "Phạm Tường Vy",
    birthDate: new Date("2019-09-18"),
    parentId: parentLan.id,
    status: "EVALUATION",
    leadSource: "Zalo OA",
    leadNote: "Đang chờ tư vấn kết quả học thử.",
    assignedTeacherId: teacherFun.id
  })
  const studentKhoa = await upsertStudent({
    name: "Đặng Minh Khoa",
    birthDate: new Date("2017-07-07"),
    parentId: parentQuang.id,
    status: "CONVERTED",
    leadSource: "Event",
    leadNote: "Phụ huynh đã đồng ý đóng phí, chờ xếp lớp.",
    assignedTeacherId: teacherRobotics.id
  })
  await upsertStudent({
    name: "Võ Gia Linh",
    birthDate: new Date("2020-03-22"),
    parentId: parentMai.id,
    status: "LEAD",
    leadSource: "Website",
    leadNote: "Mới để lại số điện thoại, chưa gọi lần đầu.",
    assignedTeacherId: teacherFun.id
  })

  const [enrollAnRobotics, enrollNamRobotics, , enrollVyFun, enrollKhoaRobotics] = await Promise.all([
    upsertEnrollment({
      studentId: studentAn.id,
      courseId: roboticsBasic.id,
      sessionsBought: 12,
      sessionsUsed: 4
    }),
    upsertEnrollment({
      studentId: studentNam.id,
      courseId: roboticsBasic.id,
      sessionsBought: 12,
      sessionsUsed: 11
    }),
    upsertEnrollment({
      studentId: studentNgoc.id,
      courseId: funExplorers.id,
      sessionsBought: 1,
      sessionsUsed: 0
    }),
    upsertEnrollment({
      studentId: studentVy.id,
      courseId: funExplorers.id,
      sessionsBought: 1,
      sessionsUsed: 0
    }),
    upsertEnrollment({
      studentId: studentKhoa.id,
      courseId: roboticsAdvanced.id,
      sessionsBought: 16,
      sessionsUsed: 0
    })
  ])

  const [roboticsTodayClass, funTodayClass] = await Promise.all([
    upsertClass({
      name: "Robotics Demo - Hôm nay",
      courseId: roboticsBasic.id,
      teacherId: teacherRobotics.id,
      weekday: todayWeekday,
      startTime: "09:00",
      endTime: "10:30",
      room: "Phòng Robotics"
    }),
    upsertClass({
      name: "FUN Demo - Hôm nay",
      courseId: funExplorers.id,
      teacherId: teacherFun.id,
      weekday: todayWeekday,
      startTime: "16:00",
      endTime: "17:15",
      room: "Phòng FUN"
    })
  ])

  await Promise.all([
    upsertClassStudent(roboticsTodayClass.id, studentAn.id),
    upsertClassStudent(roboticsTodayClass.id, studentNam.id),
    upsertClassStudent(funTodayClass.id, studentNgoc.id),
    upsertClassStudent(funTodayClass.id, studentVy.id)
  ])

  const roboticsSession = await upsertClassSession(roboticsTodayClass.id, "Robot di chuyển theo lộ trình")
  await upsertTodayAttendance({
    enrollmentId: enrollAnRobotics.id,
    classSessionId: roboticsSession.id,
    status: "PRESENT",
    markedById: teacherRobotics.id,
    note: "Seed attendance: bé An có mặt."
  })

  await Promise.all([
    upsertReceipt({
      code: "PT-2026-0001",
      enrollmentId: enrollAnRobotics.id,
      amount: 3000000,
      sessions: 12,
      method: "BANK_TRANSFER",
      note: "Học phí Robotics cơ bản.",
      createdById: sale.id,
      createdAt: daysAgo(18)
    }),
    upsertReceipt({
      code: "PT-2026-0002",
      enrollmentId: enrollNamRobotics.id,
      amount: 3000000,
      sessions: 12,
      method: "CASH",
      note: "Học phí Robotics cơ bản.",
      createdById: sale.id,
      createdAt: daysAgo(12)
    }),
    upsertReceipt({
      code: "PT-2026-0003",
      enrollmentId: enrollKhoaRobotics.id,
      amount: 4200000,
      sessions: 16,
      method: "BANK_TRANSFER",
      note: "Đóng phí Robotics nâng cao.",
      createdById: sale.id,
      createdAt: daysAgo(2)
    }),
    upsertExpense({
      code: "PC-2026-0001",
      category: "MATERIALS",
      amount: 850000,
      description: "Mua kit Lego và pin sạc cho lớp Robotics.",
      date: daysAgo(6),
      createdById: admin.id
    }),
    upsertExpense({
      code: "PC-2026-0002",
      category: "MARKETING",
      amount: 500000,
      description: "Chạy quảng cáo Facebook cho lớp FUN.",
      date: daysAgo(3),
      createdById: admin.id
    })
  ])

  await Promise.all([
    upsertTask({
      title: "Gọi phụ huynh bé Ngọc sau buổi học thử",
      dueDate: dayAt(17),
      studentId: studentNgoc.id,
      assignedToId: sale.id,
      createdById: admin.id,
      note: "Lead trial quá 3 ngày cần follow-up."
    }),
    upsertTask({
      title: "Tư vấn gia hạn cho bé Nam",
      dueDate: dayAt(15),
      studentId: studentNam.id,
      assignedToId: sale.id,
      createdById: admin.id,
      note: "Còn 1 buổi, cần tư vấn khóa tiếp theo."
    })
  ])

  await Promise.all([
    createContactLogIfMissing({
      studentId: studentNgoc.id,
      loggedById: sale.id,
      content: "Phụ huynh quan tâm FUN nhưng muốn xem thêm tiến bộ sau học thử.",
      result: "NEED_TIME",
      createdAt: daysAgo(4)
    }),
    createContactLogIfMissing({
      studentId: studentKhoa.id,
      loggedById: sale.id,
      content: "Đã chốt Robotics nâng cao, chờ xếp lịch phù hợp.",
      result: "CONVERTED",
      createdAt: daysAgo(2)
    })
  ])

  await Promise.all([
    upsertWeeklyAssessment({
      studentId: studentAn.id,
      enrollmentId: enrollAnRobotics.id,
      subject: "ROBOTICS",
      rubricVersion: ROBOTICS_RUBRIC.version,
      weekNumber: 1,
      teacherId: teacherRobotics.id,
      mode: "complete",
      comment: "Hoàn thành tốt thử thách robot tuần 1.",
      rubric: ROBOTICS_RUBRIC
    }),
    upsertWeeklyAssessment({
      studentId: studentAn.id,
      enrollmentId: enrollAnRobotics.id,
      subject: "ROBOTICS",
      rubricVersion: ROBOTICS_RUBRIC.version,
      weekNumber: 2,
      teacherId: teacherRobotics.id,
      mode: "partial",
      comment: "Cần luyện thêm giải thích thuật toán.",
      rubric: ROBOTICS_RUBRIC
    }),
    upsertWeeklyAssessment({
      studentId: studentVy.id,
      enrollmentId: enrollVyFun.id,
      subject: "FUN",
      rubricVersion: FUN_RUBRIC.version,
      weekNumber: 1,
      teacherId: teacherFun.id,
      mode: "complete",
      comment: "Tự tin giao tiếp và hợp tác tốt.",
      rubric: FUN_RUBRIC
    })
  ])

  await upsertFinalAssessment({
    studentId: studentVy.id,
    enrollmentId: enrollVyFun.id,
    subject: "FUN",
    rubricVersion: FUN_RUBRIC.version,
    requiredWeeks: 1,
    completedWeeks: 1,
    teacherId: teacherFun.id
  })

  await ensureVietnamPublicHolidays(prisma, 2026)

  console.info("Kid Seeds Hub seed data is ready.")
  console.info("Demo accounts:")
  console.info("- Admin: 0900000001 / Admin@123")
  console.info("- Sale: 0900000002 / Sale@123")
  console.info("- Teacher Robotics: 0900000003 / Teacher@123")
  console.info("- Teacher FUN: 0900000005 / Teacher@123")
  console.info("- Parent sample: 0911000001 / Parent@123")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
