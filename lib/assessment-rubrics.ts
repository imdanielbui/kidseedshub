export const progressLevels = ["BEGINNING", "PROGRESSING", "PROFICIENT"] as const

export type ProgressLevel = (typeof progressLevels)[number]

import type { AssessmentRubricConfigItem } from "@/lib/contracts/assessment"

export type AssessmentRubric = Pick<AssessmentRubricConfigItem, "subject" | "version" | "domains">

export const FUN_RUBRIC: AssessmentRubric = {
  subject: "FUN",
  version: "2026-05-fastrack-inspired-v1",
  domains: [
    {
      key: "communication",
      label: "Kỹ năng giao tiếp",
      skills: [
        { key: "listening", label: "Lắng nghe chủ động", outcomes: ["Lắng nghe hướng dẫn", "Phản hồi khi được hỏi", "Diễn đạt lại ý chính"] },
        { key: "speaking", label: "Diễn đạt ý tưởng", outcomes: ["Nói rõ nhu cầu", "Chia sẻ quan sát", "Trình bày ngắn trước nhóm"] }
      ]
    },
    {
      key: "thinking",
      label: "Kỹ năng tư duy",
      skills: [
        { key: "observation", label: "Quan sát", outcomes: ["Nhận ra chi tiết", "So sánh điểm giống/khác", "Đặt câu hỏi phù hợp"] },
        { key: "reasoning", label: "Suy luận", outcomes: ["Dự đoán kết quả", "Giải thích lựa chọn", "Tìm cách làm khác"] }
      ]
    },
    {
      key: "creativity_expression",
      label: "Sáng tạo và biểu đạt",
      skills: [
        { key: "creative_ideas", label: "Ý tưởng sáng tạo", outcomes: ["Thêm chi tiết riêng", "Thử vật liệu/cách làm mới", "Hoàn thiện sản phẩm theo ý tưởng"] },
        { key: "expression", label: "Biểu đạt qua hoạt động", outcomes: ["Thể hiện cảm xúc", "Kể lại quá trình", "Chia sẻ sản phẩm"] }
      ]
    },
    {
      key: "interpersonal",
      label: "Kỹ năng tương tác",
      skills: [
        { key: "cooperation", label: "Hợp tác", outcomes: ["Chờ lượt", "Chia sẻ dụng cụ", "Làm việc cùng bạn"] },
        { key: "empathy", label: "Đồng cảm", outcomes: ["Nhận biết cảm xúc bạn", "Biết an ủi/hỗ trợ", "Tôn trọng khác biệt"] }
      ]
    },
    {
      key: "intrapersonal",
      label: "Kỹ năng tự thân",
      skills: [
        { key: "focus", label: "Tập trung", outcomes: ["Theo hoạt động đến cùng", "Ít bị phân tâm", "Tự quay lại nhiệm vụ"] },
        { key: "confidence", label: "Tự tin", outcomes: ["Thử nhiệm vụ mới", "Không bỏ cuộc sớm", "Tự nhận xét sản phẩm"] }
      ]
    }
  ]
}

export const roboticsScoreMatrix = {
  logic: {
    1: "Cần hướng dẫn nhiều để nhận ra quy luật logic cơ bản.",
    2: "Nhận diện được logic cơ bản nhưng còn lúng túng khi áp dụng.",
    3: "Nắm vững logic cơ bản, có thể tự giải quyết các bài toán quen thuộc.",
    4: "Tư duy logic tốt, phân tích vấn đề nhanh và chính xác.",
    5: "Tư duy logic xuất sắc, có khả năng suy luận và giải quyết bài toán phức tạp."
  },
  algorithm: {
    1: "Chưa nắm rõ cấu trúc thuật toán cơ bản.",
    2: "Hiểu cơ bản nhưng chưa tối ưu được thuật toán.",
    3: "Áp dụng tốt thuật toán cơ bản vào bài toán thực tế.",
    4: "Xây dựng thuật toán hiệu quả, ít lỗi.",
    5: "Tối ưu hóa thuật toán xuất sắc, tư duy lập trình vượt trội."
  },
  creativity: {
    1: "Thường làm theo mẫu, ít có ý tưởng mới.",
    2: "Có ý tưởng nhưng chưa biết cách triển khai.",
    3: "Sáng tạo tốt trong phạm vi bài học.",
    4: "Thường xuyên có những ý tưởng độc đáo và thú vị.",
    5: "Sáng tạo vượt bậc, luôn tìm ra cách giải quyết mới lạ."
  },
  problem_solving: {
    1: "Dễ nản chí khi gặp lỗi, cần giáo viên hỗ trợ liên tục.",
    2: "Biết cách tìm lỗi nhưng chưa tự sửa được.",
    3: "Tự giải quyết được các lỗi cơ bản.",
    4: "Kỹ năng gỡ lỗi tốt, chủ động tìm kiếm giải pháp.",
    5: "Giải quyết vấn đề xuất sắc, độc lập và linh hoạt."
  },
  perseverance: {
    1: "Dễ mất tập trung, cần nhắc nhở nhiều.",
    2: "Tập trung trong thời gian ngắn.",
    3: "Hoàn thành tốt nhiệm vụ được giao.",
    4: "Kiên trì theo đuổi mục tiêu đến cùng.",
    5: "Sự tập trung cao độ, không bỏ cuộc trước khó khăn."
  },
  presentation: {
    1: "Còn rụt rè, chưa tự tin trình bày sản phẩm.",
    2: "Trình bày được nội dung cơ bản nhưng chưa trôi chảy.",
    3: "Trình bày rõ ràng, tự tin.",
    4: "Kỹ năng thuyết trình tốt, thu hút người nghe.",
    5: "Thuyết trình xuất sắc, lập luận chặt chẽ, thuyết phục."
  },
  teamwork: {
    1: "Thích làm việc độc lập, ít tương tác với bạn bè.",
    2: "Có tham gia nhóm nhưng chưa chủ động.",
    3: "Hợp tác tốt, hoàn thành phần việc được giao.",
    4: "Tích cực hỗ trợ các thành viên khác.",
    5: "Kỹ năng làm việc nhóm xuất sắc, gắn kết mọi người."
  },
  leadership: {
    1: "Chưa thể hiện vai trò dẫn dắt.",
    2: "Có khả năng điều phối nhưng chưa tự tin.",
    3: "Phân công công việc rõ ràng cho các thành viên.",
    4: "Dẫn dắt nhóm hoạt động hiệu quả.",
    5: "Tố chất lãnh đạo nổi bật, truyền cảm hứng cho nhóm."
  }
} as const

function roboticsScoreDescriptions(key: keyof typeof roboticsScoreMatrix) {
  return {
    "5-6": roboticsScoreMatrix[key],
    "7-10": roboticsScoreMatrix[key],
    "11-14": roboticsScoreMatrix[key]
  }
}

export const ROBOTICS_RUBRIC: AssessmentRubric = {
  subject: "ROBOTICS",
  version: "2026-05-ksh-robotics-score-v2",
  domains: [
    {
      key: "robotics_core_skills",
      label: "8 kỹ năng Robotics",
      skills: [
        {
          key: "logic",
          label: "Logic",
          description: "Khả năng nhận biết quy luật, phân tích và giải thích logic của giải pháp.",
          ageDescriptions: {
            "5-6": "Nhận biết quy luật cơ bản.",
            "7-10": "Khả năng tổng hợp và phân tích.",
            "11-14": "Phân tích hệ thống phức tạp."
          },
          outcomes: ["Điểm tổng thể"],
          matrixKey: "logic",
          scoreDescriptions: roboticsScoreDescriptions("logic")
        },
        {
          key: "algorithm",
          label: "Thuật toán",
          description: "Khả năng sắp xếp bước làm, dùng cấu trúc điều khiển và tối ưu cách giải.",
          ageDescriptions: {
            "5-6": "Sắp xếp các bước đơn giản.",
            "7-10": "Hiệu suất và cấu trúc.",
            "11-14": "Tối ưu hóa thuật toán và mã nguồn."
          },
          outcomes: ["Điểm tổng thể"],
          matrixKey: "algorithm",
          scoreDescriptions: roboticsScoreDescriptions("algorithm")
        },
        {
          key: "creativity",
          label: "Sáng tạo",
          description: "Khả năng tạo ý tưởng mới và mở rộng sản phẩm ngoài mẫu ban đầu.",
          ageDescriptions: {
            "5-6": "Tạo ra sản phẩm mới.",
            "7-10": "Cách tiếp cận giải pháp mới.",
            "11-14": "Thiết kế giải pháp có tính ứng dụng riêng."
          },
          outcomes: ["Điểm tổng thể"],
          matrixKey: "creativity",
          scoreDescriptions: roboticsScoreDescriptions("creativity")
        },
        {
          key: "problem_solving",
          label: "Giải quyết vấn đề",
          description: "Khả năng tìm lỗi, thử nghiệm phương án và xử lý tình huống khi robot chưa hoạt động đúng.",
          ageDescriptions: {
            "5-6": "Tìm cách sửa lỗi đơn giản với hỗ trợ.",
            "7-10": "Xử lý tình huống trong quá trình làm dự án.",
            "11-14": "Gỡ lỗi độc lập và đánh giá nhiều phương án."
          },
          outcomes: ["Điểm tổng thể"],
          matrixKey: "problem_solving",
          scoreDescriptions: roboticsScoreDescriptions("problem_solving")
        },
        {
          key: "persistence",
          label: "Kiên trì",
          description: "Sự tập trung, nỗ lực và khả năng theo đuổi mục tiêu đến khi hoàn thành.",
          ageDescriptions: {
            "5-6": "Duy trì tập trung trong hoạt động ngắn.",
            "7-10": "Sự tập trung và nỗ lực.",
            "11-14": "Bền bỉ qua các thử thách kỹ thuật dài hơn."
          },
          outcomes: ["Điểm tổng thể"],
          matrixKey: "perseverance",
          scoreDescriptions: roboticsScoreDescriptions("perseverance")
        },
        {
          key: "presentation",
          label: "Thuyết trình",
          description: "Khả năng trình bày sản phẩm, giải thích cách hoạt động và trả lời câu hỏi.",
          ageDescriptions: {
            "5-6": "Mô tả sản phẩm bằng câu đơn giản.",
            "7-10": "Kỹ năng trình bày.",
            "11-14": "Lập luận kỹ thuật và thuyết phục người nghe."
          },
          outcomes: ["Điểm tổng thể"],
          matrixKey: "presentation",
          scoreDescriptions: roboticsScoreDescriptions("presentation")
        },
        {
          key: "teamwork",
          label: "Làm việc nhóm",
          description: "Khả năng hợp tác, chia sẻ nhiệm vụ và hỗ trợ bạn trong quá trình làm dự án.",
          ageDescriptions: {
            "5-6": "Biết chia sẻ và chờ lượt.",
            "7-10": "Kỹ năng hợp tác.",
            "11-14": "Phối hợp vai trò trong nhóm dự án."
          },
          outcomes: ["Điểm tổng thể"],
          matrixKey: "teamwork",
          scoreDescriptions: roboticsScoreDescriptions("teamwork")
        },
        {
          key: "leadership",
          label: "Lãnh đạo",
          description: "Khả năng dẫn dắt, tổ chức công việc và tạo ảnh hưởng tích cực trong nhóm.",
          ageDescriptions: {
            "5-6": "Bắt đầu chủ động đề xuất vai trò.",
            "7-10": "Dẫn dắt và tổ chức.",
            "11-14": "Điều phối nhóm và truyền cảm hứng."
          },
          outcomes: ["Điểm tổng thể"],
          matrixKey: "leadership",
          scoreDescriptions: roboticsScoreDescriptions("leadership")
        }
      ]
    }
  ]
}

export const assessmentRubrics = {
  FUN: FUN_RUBRIC,
  ROBOTICS: ROBOTICS_RUBRIC
} as const
