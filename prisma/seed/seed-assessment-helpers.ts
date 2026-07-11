import {
  type PrismaClient,
  type CourseSubject,
  type ProgressLevel,
} from "@prisma/client";
import { type AssessmentRubric } from "../../lib/assessment-rubrics";

let prisma: PrismaClient;

function rubricItems(rubric: AssessmentRubric, mode: "complete" | "partial") {
  const levels: ProgressLevel[] = ["BEGINNING", "PROGRESSING", "PROFICIENT"];
  let index = 0;

  return rubric.domains.flatMap((domain) =>
    domain.skills.flatMap((skill) =>
      skill.outcomes.map((_, outcomeIndex) => {
        const checked = mode === "complete" || index % 3 !== 0;
        const progressLevel = levels[index % levels.length];
        index += 1;

        return {
          domainKey: domain.key,
          skillKey: skill.key,
          outcomeIndex,
          checked,
          progressLevel,
          ...(rubric.subject === "ROBOTICS"
            ? {
                score: checked
                  ? progressLevel === "PROFICIENT"
                    ? 5
                    : progressLevel === "PROGRESSING"
                      ? 3
                      : 1
                  : undefined,
              }
            : {}),
          comment: checked
            ? "Quan sát tốt trong buổi học."
            : "Cần tiếp tục theo dõi.",
        };
      }),
    ),
  );
}

async function upsertRubricConfig(input: {
  rubric: AssessmentRubric;
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    const config = await tx.assessmentRubricConfig.upsert({
      where: {
        subject_version: {
          subject: input.rubric.subject,
          version: input.rubric.version,
        },
      },
      update: {
        status: "ACTIVE",
        domainsJson: input.rubric.domains,
        createdById: input.createdById,
        activatedAt: new Date(),
      },
      create: {
        subject: input.rubric.subject,
        version: input.rubric.version,
        status: "ACTIVE",
        domainsJson: input.rubric.domains,
        createdById: input.createdById,
        activatedAt: new Date(),
      },
    });

    await tx.assessmentRubricConfig.updateMany({
      where: {
        subject: input.rubric.subject,
        status: "ACTIVE",
        id: { not: config.id },
      },
      data: { status: "ARCHIVED" },
    });

    return config;
  });
}

async function upsertWeeklyAssessment(input: {
  studentId: string;
  enrollmentId: string;
  subject: CourseSubject;
  rubricVersion: string;
  weekNumber: number;
  teacherId: string;
  mode: "complete" | "partial";
  comment: string;
  rubric: AssessmentRubric;
}) {
  const items = rubricItems(input.rubric, input.mode);
  const status = items.every((item) => item.checked)
    ? "COMPLETE"
    : "IN_PROGRESS";
  const rubricConfig = await prisma.assessmentRubricConfig.findUnique({
    where: {
      subject_version: {
        subject: input.subject,
        version: input.rubricVersion,
      },
    },
  });
  const rubricSnapshot = {
    subject: input.subject,
    version: input.rubricVersion,
    domains: input.rubric.domains,
  };

  return prisma.weeklyAssessment.upsert({
    where: {
      enrollmentId_weekNumber_subject: {
        enrollmentId: input.enrollmentId,
        weekNumber: input.weekNumber,
        subject: input.subject,
      },
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
        create: items,
      },
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
        create: items,
      },
    },
  });
}

async function upsertFinalAssessment(input: {
  studentId: string;
  enrollmentId: string;
  subject: CourseSubject;
  rubricVersion: string;
  requiredWeeks: number;
  completedWeeks: number;
  teacherId: string;
}) {
  const existing = await prisma.finalAssessment.findFirst({
    where: {
      enrollmentId: input.enrollmentId,
      subject: input.subject,
    },
  });

  const data = {
    studentId: input.studentId,
    enrollmentId: input.enrollmentId,
    subject: input.subject,
    rubricVersion: input.rubricVersion,
    requiredWeeks: input.requiredWeeks,
    completedWeeks: input.completedWeeks,
    strengths: "Tự tin tham gia hoạt động nhóm, biết trình bày sản phẩm.",
    improvements:
      "Cần luyện thêm việc giải thích lựa chọn và tự đánh giá sau hoạt động.",
    teacherSummary:
      "Học viên hoàn thành tốt mục tiêu khóa học giả định trong seed data.",
    nextSteps: "Tiếp tục lên lớp Robotics nâng cao hoặc FUN communication.",
    teacherId: input.teacherId,
    status: "PUBLISHED" as const,
    publishedAt: new Date(),
    publishedById: input.teacherId,
  };

  if (existing) {
    return prisma.finalAssessment.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.finalAssessment.create({ data });
}

export function createSeedAssessmentHelpers(client: PrismaClient) {
  prisma = client;

  return {
    upsertRubricConfig,
    upsertWeeklyAssessment,
    upsertFinalAssessment,
  };
}
