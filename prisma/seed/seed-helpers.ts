import bcrypt from "bcryptjs";
import {
  type PrismaClient,
  type ContactResult,
  type ExpenseCategory,
  type PaymentMethod,
  type StudentStatus,
} from "@prisma/client";
import { nextStudentCode } from "../../lib/backend/codes";

let prisma: PrismaClient;

export const today = new Date();
export const todayWeekday = today.getDay();
export const staleDate = daysAgo(5);
const seedModes = ["demo", "production"] as const;
const forbiddenProductionSeedPasswords = new Set([
  "Admin@123",
  "Sale@123",
  "Teacher@123",
  "Parent@123",
]);

export type SeedMode = (typeof seedModes)[number];

export function readSeedMode(): SeedMode {
  const mode = process.env.KIDSEEDSHUB_SEED_MODE?.trim().toLowerCase();

  if (mode && !seedModes.includes(mode as SeedMode)) {
    throw new Error(
      "KIDSEEDSHUB_SEED_MODE must be either 'demo' or 'production'.",
    );
  }

  const resolvedMode =
    (mode as SeedMode | undefined) ??
    (process.env.NODE_ENV === "production" ? "production" : "demo");

  if (
    resolvedMode === "demo" &&
    process.env.NODE_ENV === "production" &&
    process.env.KIDSEEDSHUB_ALLOW_DEMO_SEED !== "true"
  ) {
    throw new Error(
      "Demo seed is blocked in production. Set KIDSEEDSHUB_ALLOW_DEMO_SEED=true only for an isolated demo database.",
    );
  }

  return resolvedMode;
}

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for production seed bootstrap.`);
  }

  return value;
}

export function assertProductionSeedPassword(password: string) {
  if (password.length < 12) {
    throw new Error(
      "KIDSEEDSHUB_ADMIN_PASSWORD must be at least 12 characters for production seed bootstrap.",
    );
  }

  if (forbiddenProductionSeedPasswords.has(password)) {
    throw new Error("KIDSEEDSHUB_ADMIN_PASSWORD cannot use a demo password.");
  }
}

export function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(9, 0, 0, 0);
  return date;
}

export function dayAt(hour: number, minute = 0) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function nextDateForWeekday(startDate: Date, weekday: number) {
  const date = startOfDay(startDate);
  const delta = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + delta);
  return date;
}

async function upsertUser(input: {
  name: string;
  phone: string;
  email: string;
  password: string;
  role: "ADMIN" | "SALE" | "TEACHER" | "PARENT";
}) {
  const password = await bcrypt.hash(input.password, 10);

  return prisma.user.upsert({
    where: { phone: input.phone },
    update: {
      name: input.name,
      email: input.email,
      password,
      role: input.role,
      isActive: true,
    },
    create: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      password,
      role: input.role,
      isActive: true,
    },
  });
}

async function upsertParent(input: {
  name: string;
  phone: string;
  email: string;
}) {
  const user = await upsertUser({
    ...input,
    password: "Parent@123",
    role: "PARENT",
  });

  return prisma.parent.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
    include: { user: true },
  });
}

async function upsertCourse(input: {
  name: string;
  subject: string;
  totalSessions: number;
  price: number;
  description: string;
}) {
  const existing = await prisma.course.findFirst({
    where: { name: input.name },
  });

  if (existing) {
    return prisma.course.update({
      where: { id: existing.id },
      data: {
        subject: input.subject,
        totalSessions: input.totalSessions,
        price: input.price,
        description: input.description,
        isActive: true,
      },
    });
  }

  return prisma.course.create({ data: input });
}

async function upsertStudent(input: {
  name: string;
  birthDate: Date;
  parentId: string;
  status: StudentStatus;
  leadSource: string;
  leadNote: string;
  healthNote?: string;
  assignedTeacherId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const existing = await prisma.student.findFirst({
    where: {
      name: input.name,
      parentId: input.parentId,
    },
  });

  const data = {
    birthDate: input.birthDate,
    status: input.status,
    stageChangedAt: input.updatedAt ?? input.createdAt ?? new Date(),
    leadSource: input.leadSource,
    leadNote: input.leadNote,
    healthNote: input.healthNote,
    assignedTeacherId: input.assignedTeacherId,
    updatedAt: input.updatedAt,
  };

  if (existing) {
    return prisma.student.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.student.create({
    data: {
      code: await nextStudentCode(prisma, input.createdAt ?? new Date()),
      name: input.name,
      parentId: input.parentId,
      createdAt: input.createdAt,
      ...data,
    },
  });
}

async function upsertEnrollment(input: {
  studentId: string;
  courseId: string;
  sessionsBought: number;
  sessionsUsed: number;
  isActive?: boolean;
  startDate?: Date;
}) {
  const existing = await prisma.enrollment.findFirst({
    where: {
      studentId: input.studentId,
      courseId: input.courseId,
    },
  });

  const data = {
    sessionsBought: input.sessionsBought,
    sessionsUsed: input.sessionsUsed,
    isActive: input.isActive ?? true,
    startDate: input.startDate ?? daysAgo(20),
  };

  if (existing) {
    return prisma.enrollment.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.enrollment.create({
    data: {
      studentId: input.studentId,
      courseId: input.courseId,
      ...data,
    },
  });
}

async function upsertClass(input: {
  name: string;
  courseId: string;
  teacherId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room: string;
}) {
  const existing = await prisma.class.findFirst({
    where: { name: input.name },
  });
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: input.courseId },
  });

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
          isActive: true,
        },
      })
    : await prisma.class.create({
        data: {
          ...input,
          startDate: startOfDay(today),
          plannedSessions: course.totalSessions,
        },
      });

  await syncClassSchedule(klass.id, {
    weekday: input.weekday,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room,
    plannedSessions: course.totalSessions,
  });

  return klass;
}

async function syncClassSchedule(
  classId: string,
  input: {
    weekday: number;
    startTime: string;
    endTime: string;
    room: string;
    plannedSessions: number;
  },
) {
  await prisma.classScheduleSlot.deleteMany({ where: { classId } });
  await prisma.classSession.deleteMany({
    where: {
      classId,
      attendances: { none: {} },
    },
  });

  const slot = await prisma.classScheduleSlot.create({
    data: {
      classId,
      weekday: input.weekday,
      startTime: input.startTime,
      endTime: input.endTime,
      room: input.room,
    },
  });

  const date = nextDateForWeekday(today, input.weekday);

  for (let index = 0; index < input.plannedSessions; index += 1) {
    const sessionDate = startOfDay(date);
    await prisma.classSession.upsert({
      where: {
        classId_date: {
          classId,
          date: sessionDate,
        },
      },
      update: {
        scheduleSlotId: slot.id,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
        status: "SCHEDULED",
      },
      create: {
        classId,
        scheduleSlotId: slot.id,
        date: sessionDate,
        startTime: input.startTime,
        endTime: input.endTime,
        room: input.room,
        status: "SCHEDULED",
      },
    });
    date.setDate(date.getDate() + 7);
  }
}

async function upsertClassStudent(classId: string, studentId: string) {
  return prisma.classStudent.upsert({
    where: {
      classId_studentId: {
        classId,
        studentId,
      },
    },
    update: { isActive: true },
    create: {
      classId,
      studentId,
      isActive: true,
    },
  });
}

async function upsertClassSession(classId: string, topic: string) {
  const date = startOfDay(today);

  return prisma.classSession.upsert({
    where: {
      classId_date: {
        classId,
        date,
      },
    },
    update: { topic },
    create: {
      classId,
      date,
      startTime: "09:00",
      endTime: "10:30",
      topic,
    },
  });
}

async function upsertReceipt(input: {
  code: string;
  enrollmentId: string;
  amount: number;
  sessions: number;
  method: PaymentMethod;
  note: string;
  createdById: string;
  createdAt?: Date;
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
      createdAt: input.createdAt,
    },
    create: input,
  });
}

async function upsertExpense(input: {
  code: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  date: Date;
  createdById: string;
  invoiceUrl?: string;
}) {
  return prisma.expense.upsert({
    where: { code: input.code },
    update: input,
    create: input,
  });
}

async function upsertTask(input: {
  title: string;
  dueDate: Date;
  studentId?: string;
  assignedToId: string;
  createdById: string;
  note: string;
}) {
  const existing = await prisma.task.findFirst({
    where: {
      title: input.title,
      studentId: input.studentId,
    },
  });

  if (existing) {
    return prisma.task.update({
      where: { id: existing.id },
      data: {
        dueDate: input.dueDate,
        assignedToId: input.assignedToId,
        createdById: input.createdById,
        note: input.note,
        status: "PENDING",
        completedAt: null,
      },
    });
  }

  return prisma.task.create({ data: input });
}

async function createContactLogIfMissing(input: {
  studentId: string;
  loggedById: string;
  content: string;
  result: ContactResult;
  createdAt: Date;
}) {
  const existing = await prisma.contactLog.findFirst({
    where: {
      studentId: input.studentId,
      content: input.content,
    },
  });

  if (!existing) {
    await prisma.contactLog.create({ data: input });
  }
}

async function upsertTodayAttendance(input: {
  enrollmentId: string;
  classSessionId: string;
  status: "PRESENT" | "ABSENT_EXCUSED" | "ABSENT_NO_EXCUSE";
  markedById: string;
  note: string;
}) {
  const date = dayAt(9);
  const existing = await prisma.attendance.findFirst({
    where: {
      enrollmentId: input.enrollmentId,
      date: {
        gte: startOfDay(date),
        lt: new Date(startOfDay(date).getTime() + 24 * 60 * 60 * 1000),
      },
    },
  });

  if (existing) {
    return prisma.attendance.update({
      where: { id: existing.id },
      data: {
        classSessionId: input.classSessionId,
        status: input.status,
        markedById: input.markedById,
        note: input.note,
      },
    });
  }

  return prisma.attendance.create({
    data: {
      enrollmentId: input.enrollmentId,
      classSessionId: input.classSessionId,
      date,
      status: input.status,
      markedById: input.markedById,
      note: input.note,
    },
  });
}

export function createSeedHelpers(client: PrismaClient) {
  prisma = client;

  return {
    upsertUser,
    upsertParent,
    upsertCourse,
    upsertStudent,
    upsertEnrollment,
    upsertClass,
    upsertClassStudent,
    upsertClassSession,
    upsertReceipt,
    upsertExpense,
    upsertTask,
    createContactLogIfMissing,
    upsertTodayAttendance,
  };
}
