import { PrismaClient } from "@prisma/client";
import { ensureVietnamPublicHolidays } from "../lib/backend/vietnam-public-holidays";
import { FUN_RUBRIC, ROBOTICS_RUBRIC } from "../lib/assessment-rubrics";
import { createSeedAssessmentHelpers } from "./seed/seed-assessment-helpers";
import {
  assertProductionSeedPassword,
  createSeedHelpers,
  dayAt,
  daysAgo,
  readSeedMode,
  requiredEnv,
  staleDate,
  todayWeekday,
} from "./seed/seed-helpers";

const prisma = new PrismaClient();
const {
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
} = createSeedHelpers(prisma);
const { upsertRubricConfig, upsertWeeklyAssessment, upsertFinalAssessment } =
  createSeedAssessmentHelpers(prisma);

async function seedProductionBootstrap() {
  const adminPassword = requiredEnv("KIDSEEDSHUB_ADMIN_PASSWORD");
  assertProductionSeedPassword(adminPassword);

  const admin = await upsertUser({
    name: requiredEnv("KIDSEEDSHUB_ADMIN_NAME"),
    phone: requiredEnv("KIDSEEDSHUB_ADMIN_PHONE"),
    email: requiredEnv("KIDSEEDSHUB_ADMIN_EMAIL"),
    password: adminPassword,
    role: "ADMIN",
  });
  const seedYear = Number(
    process.env.KIDSEEDSHUB_SEED_YEAR ?? new Date().getFullYear(),
  );

  await Promise.all([
    upsertRubricConfig({ rubric: FUN_RUBRIC, createdById: admin.id }),
    upsertRubricConfig({ rubric: ROBOTICS_RUBRIC, createdById: admin.id }),
  ]);
  await ensureVietnamPublicHolidays(
    prisma,
    Number.isFinite(seedYear) ? seedYear : new Date().getFullYear(),
  );

  console.info("Kid Seeds Hub production bootstrap is ready.");
  console.info(
    "- Admin account bootstrapped from KIDSEEDSHUB_ADMIN_* environment variables.",
  );
  console.info(
    "- Demo users, parents, students, receipts, and classes were not created.",
  );
}

async function seedDemoData() {
  const admin = await upsertUser({
    name: "Admin Kid Seeds",
    phone: "0900000001",
    email: "admin@kidseeds.vn",
    password: "Admin@123",
    role: "ADMIN",
  });
  const sale = await upsertUser({
    name: "Sale Kid Seeds",
    phone: "0900000002",
    email: "sale@kidseeds.vn",
    password: "Sale@123",
    role: "SALE",
  });
  const teacherRobotics = await upsertUser({
    name: "Teacher Robotics",
    phone: "0900000003",
    email: "robotics.teacher@kidseeds.vn",
    password: "Teacher@123",
    role: "TEACHER",
  });
  const teacherFun = await upsertUser({
    name: "Teacher FUN",
    phone: "0900000005",
    email: "fun.teacher@kidseeds.vn",
    password: "Teacher@123",
    role: "TEACHER",
  });

  await Promise.all([
    upsertRubricConfig({ rubric: FUN_RUBRIC, createdById: admin.id }),
    upsertRubricConfig({ rubric: ROBOTICS_RUBRIC, createdById: admin.id }),
  ]);

  const [
    parentHoa,
    parentMinh,
    parentTrang,
    parentLan,
    parentQuang,
    parentMai,
  ] = await Promise.all([
    upsertParent({
      name: "Chị Hoa",
      phone: "0911000001",
      email: "hoa.parent@example.com",
    }),
    upsertParent({
      name: "Anh Minh",
      phone: "0911000002",
      email: "minh.parent@example.com",
    }),
    upsertParent({
      name: "Chị Trang",
      phone: "0911000003",
      email: "trang.parent@example.com",
    }),
    upsertParent({
      name: "Chị Lan",
      phone: "0911000004",
      email: "lan.parent@example.com",
    }),
    upsertParent({
      name: "Anh Quang",
      phone: "0911000005",
      email: "quang.parent@example.com",
    }),
    upsertParent({
      name: "Chị Mai",
      phone: "0911000006",
      email: "mai.parent@example.com",
    }),
  ]);

  const [roboticsBasic, roboticsAdvanced, funExplorers] = await Promise.all([
    upsertCourse({
      name: "Robotics Cơ bản",
      subject: "ROBOTICS",
      totalSessions: 12,
      price: 3000000,
      description: "Khóa Robotics nền tảng cho học viên mới.",
    }),
    upsertCourse({
      name: "Robotics Nâng cao",
      subject: "ROBOTICS",
      totalSessions: 16,
      price: 4200000,
      description: "Khóa Robotics nâng cao sau khi hoàn thành cơ bản.",
    }),
    upsertCourse({
      name: "FUN Explorers",
      subject: "FUN",
      totalSessions: 12,
      price: 2500000,
      description: "Khóa FUN phát triển giao tiếp, tư duy và sáng tạo.",
    }),
    upsertCourse({
      name: "FUN Communication",
      subject: "FUN",
      totalSessions: 10,
      price: 2200000,
      description: "Khóa FUN tập trung vào giao tiếp và tự tin trình bày.",
    }),
  ]);

  const studentAn = await upsertStudent({
    name: "Nguyễn Minh An",
    birthDate: new Date("2019-05-10"),
    parentId: parentHoa.id,
    status: "ACTIVE",
    leadSource: "Facebook Ads",
    leadNote: "Thích lắp ráp robot và đã đóng học phí Robotics.",
    healthNote: "Dễ mất tập trung sau 60 phút.",
    assignedTeacherId: teacherRobotics.id,
  });
  const studentNgoc = await upsertStudent({
    name: "Trần Bảo Ngọc",
    birthDate: new Date("2020-02-20"),
    parentId: parentMinh.id,
    status: "TRIAL",
    leadSource: "Referral",
    leadNote: "Đã học thử FUN, cần sale follow-up.",
    assignedTeacherId: teacherFun.id,
    createdAt: staleDate,
    updatedAt: staleDate,
  });
  const studentNam = await upsertStudent({
    name: "Lê Hoàng Nam",
    birthDate: new Date("2018-11-12"),
    parentId: parentTrang.id,
    status: "RETENTION",
    leadSource: "Walk-in",
    leadNote: "Sắp hết buổi Robotics, cần tư vấn gia hạn.",
    assignedTeacherId: teacherRobotics.id,
  });
  const studentVy = await upsertStudent({
    name: "Phạm Tường Vy",
    birthDate: new Date("2019-09-18"),
    parentId: parentLan.id,
    status: "EVALUATION",
    leadSource: "Zalo OA",
    leadNote: "Đang chờ tư vấn kết quả học thử.",
    assignedTeacherId: teacherFun.id,
  });
  const studentKhoa = await upsertStudent({
    name: "Đặng Minh Khoa",
    birthDate: new Date("2017-07-07"),
    parentId: parentQuang.id,
    status: "CONVERTED",
    leadSource: "Event",
    leadNote: "Phụ huynh đã đồng ý đóng phí, chờ xếp lớp.",
    assignedTeacherId: teacherRobotics.id,
  });
  await upsertStudent({
    name: "Võ Gia Linh",
    birthDate: new Date("2020-03-22"),
    parentId: parentMai.id,
    status: "LEAD",
    leadSource: "Website",
    leadNote: "Mới để lại số điện thoại, chưa gọi lần đầu.",
    assignedTeacherId: teacherFun.id,
  });

  const [
    enrollAnRobotics,
    enrollNamRobotics,
    ,
    enrollVyFun,
    enrollKhoaRobotics,
  ] = await Promise.all([
    upsertEnrollment({
      studentId: studentAn.id,
      courseId: roboticsBasic.id,
      sessionsBought: 12,
      sessionsUsed: 4,
    }),
    upsertEnrollment({
      studentId: studentNam.id,
      courseId: roboticsBasic.id,
      sessionsBought: 12,
      sessionsUsed: 11,
    }),
    upsertEnrollment({
      studentId: studentNgoc.id,
      courseId: funExplorers.id,
      sessionsBought: 1,
      sessionsUsed: 0,
    }),
    upsertEnrollment({
      studentId: studentVy.id,
      courseId: funExplorers.id,
      sessionsBought: 1,
      sessionsUsed: 0,
    }),
    upsertEnrollment({
      studentId: studentKhoa.id,
      courseId: roboticsAdvanced.id,
      sessionsBought: 16,
      sessionsUsed: 0,
    }),
  ]);

  const [roboticsTodayClass, funTodayClass] = await Promise.all([
    upsertClass({
      name: "Robotics Demo - Hôm nay",
      courseId: roboticsBasic.id,
      teacherId: teacherRobotics.id,
      weekday: todayWeekday,
      startTime: "09:00",
      endTime: "10:30",
      room: "Phòng Robotics",
    }),
    upsertClass({
      name: "FUN Demo - Hôm nay",
      courseId: funExplorers.id,
      teacherId: teacherFun.id,
      weekday: todayWeekday,
      startTime: "16:00",
      endTime: "17:15",
      room: "Phòng FUN",
    }),
  ]);

  await Promise.all([
    upsertClassStudent(roboticsTodayClass.id, studentAn.id),
    upsertClassStudent(roboticsTodayClass.id, studentNam.id),
    upsertClassStudent(funTodayClass.id, studentNgoc.id),
    upsertClassStudent(funTodayClass.id, studentVy.id),
  ]);

  const roboticsSession = await upsertClassSession(
    roboticsTodayClass.id,
    "Robot di chuyển theo lộ trình",
  );
  await upsertTodayAttendance({
    enrollmentId: enrollAnRobotics.id,
    classSessionId: roboticsSession.id,
    status: "PRESENT",
    markedById: teacherRobotics.id,
    note: "Seed attendance: bé An có mặt.",
  });

  await Promise.all([
    upsertReceipt({
      code: "PT-2026-0001",
      enrollmentId: enrollAnRobotics.id,
      amount: 3000000,
      sessions: 12,
      method: "BANK_TRANSFER",
      note: "Học phí Robotics cơ bản.",
      createdById: sale.id,
      createdAt: daysAgo(18),
    }),
    upsertReceipt({
      code: "PT-2026-0002",
      enrollmentId: enrollNamRobotics.id,
      amount: 3000000,
      sessions: 12,
      method: "CASH",
      note: "Học phí Robotics cơ bản.",
      createdById: sale.id,
      createdAt: daysAgo(12),
    }),
    upsertReceipt({
      code: "PT-2026-0003",
      enrollmentId: enrollKhoaRobotics.id,
      amount: 4200000,
      sessions: 16,
      method: "BANK_TRANSFER",
      note: "Đóng phí Robotics nâng cao.",
      createdById: sale.id,
      createdAt: daysAgo(2),
    }),
    upsertExpense({
      code: "PC-2026-0001",
      category: "MATERIALS",
      amount: 850000,
      description: "Mua kit Lego và pin sạc cho lớp Robotics.",
      date: daysAgo(6),
      createdById: admin.id,
    }),
    upsertExpense({
      code: "PC-2026-0002",
      category: "MARKETING",
      amount: 500000,
      description: "Chạy quảng cáo Facebook cho lớp FUN.",
      date: daysAgo(3),
      createdById: admin.id,
    }),
  ]);

  await Promise.all([
    upsertTask({
      title: "Gọi phụ huynh bé Ngọc sau buổi học thử",
      dueDate: dayAt(17),
      studentId: studentNgoc.id,
      assignedToId: sale.id,
      createdById: admin.id,
      note: "Lead trial quá 3 ngày cần follow-up.",
    }),
    upsertTask({
      title: "Tư vấn gia hạn cho bé Nam",
      dueDate: dayAt(15),
      studentId: studentNam.id,
      assignedToId: sale.id,
      createdById: admin.id,
      note: "Còn 1 buổi, cần tư vấn khóa tiếp theo.",
    }),
  ]);

  await Promise.all([
    createContactLogIfMissing({
      studentId: studentNgoc.id,
      loggedById: sale.id,
      content:
        "Phụ huynh quan tâm FUN nhưng muốn xem thêm tiến bộ sau học thử.",
      result: "NEED_TIME",
      createdAt: daysAgo(4),
    }),
    createContactLogIfMissing({
      studentId: studentKhoa.id,
      loggedById: sale.id,
      content: "Đã chốt Robotics nâng cao, chờ xếp lịch phù hợp.",
      result: "CONVERTED",
      createdAt: daysAgo(2),
    }),
  ]);

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
      rubric: ROBOTICS_RUBRIC,
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
      rubric: ROBOTICS_RUBRIC,
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
      rubric: FUN_RUBRIC,
    }),
  ]);

  await upsertFinalAssessment({
    studentId: studentVy.id,
    enrollmentId: enrollVyFun.id,
    subject: "FUN",
    rubricVersion: FUN_RUBRIC.version,
    requiredWeeks: 1,
    completedWeeks: 1,
    teacherId: teacherFun.id,
  });

  await ensureVietnamPublicHolidays(prisma, 2026);

  console.info("Kid Seeds Hub demo seed data is ready.");
  console.info("Demo accounts:");
  console.info("- Admin: 0900000001 / Admin@123");
  console.info("- Sale: 0900000002 / Sale@123");
  console.info("- Teacher Robotics: 0900000003 / Teacher@123");
  console.info("- Teacher FUN: 0900000005 / Teacher@123");
  console.info("- Parent sample: 0911000001 / Parent@123");
}

async function main() {
  const mode = readSeedMode();

  if (mode === "production") {
    await seedProductionBootstrap();
    return;
  }

  await seedDemoData();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
