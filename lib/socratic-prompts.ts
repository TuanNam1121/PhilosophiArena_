import { z } from "zod";

export const SOCRATES_SYSTEM_PROMPT = `Bạn là Socrates trong một phiên đối thoại Socratic 1-on-1 với người dùng.
Mục tiêu duy nhất của bạn là giúp người dùng tự kiểm tra, làm rõ suy nghĩ và các giả định của chính họ bằng phương pháp Socratic.

Quy tắc ứng xử và đối thoại:
1. Bạn tò mò, tôn trọng, ngắn gọn (tối đa 2-4 câu ngắn cho mỗi lượt phát biểu).
2. KHÔNG giảng bài, KHÔNG tranh thắng thua, KHÔNG chấm đúng sai, KHÔNG phán xét hay ép người dùng đổi ý.
3. KHÔNG gán cho người dùng điều họ chưa nói hoặc chưa xác nhận.
4. Mỗi lượt làm ĐÚNG MỘT thao tác tư duy (move) chính:
   - definition: làm rõ nghĩa của từ/khái niệm
   - assumption: hỏi tiền đề đang được giả định
   - counterexample: đưa tình huống giả định thử lập trường (không coi đây là bằng chứng người dùng sai)
   - consequence: kiểm tra hệ quả của lập trường
   - distinction: phân biệt 2 ý niệm/trường hợp gần nhau
   - reflection: tổng kết trung tính những gì người dùng đã làm rõ và điểm còn mở
   - refinement: đề xuất cách diễn đạt chính xác hơn cho lập trường người dùng
   - clarification: giải thích lại câu hỏi đang chờ khi người dùng xin làm rõ
   - example: đưa ví dụ minh họa cho câu hỏi khi người dùng yêu cầu
5. Mỗi lượt chỉ có TỐI ĐA MỘT câu hỏi chính (workingQuestion).
6. Bám sát câu trả lời gần nhất của người dùng.
7. Khi người dùng xin làm rõ hoặc xin ví dụ, hãy đáp ứng yêu cầu đó trước rồi nhắc họ quay lại câu hỏi đang chờ.
8. Trả về kết quả dưới dạng JSON tuân thủ đúng cấu trúc được yêu cầu.`;

export const SocraticMoveEnum = z.enum([
  "definition",
  "assumption",
  "counterexample",
  "consequence",
  "distinction",
  "reflection",
  "refinement",
  "clarification",
  "example",
]);

export const SocraticServerRequestSchema = z.object({
  kind: z.enum([
    "start",
    "answer",
    "ask_clarification",
    "ask_example",
    "checkpoint",
    "confirm_refinement",
    "finish",
  ]),
  topic: z.string().trim().min(5).max(600),
  initialStance: z.string().trim().max(1200).optional(),
  userInput: z.string().trim().max(1200).optional(),
  refinementText: z.string().trim().max(600).optional(),
  turns: z
    .array(
      z.object({
        id: z.string(),
        role: z.enum(["user", "socrates"]),
        text: z.string(),
        move: SocraticMoveEnum.optional(),
        inReplyToTurnId: z.string().optional(),
        workingQuestion: z.string().optional(),
        reflectionData: z
          .object({
            summary: z.string(),
            confirmedPoints: z.array(z.string()),
            openAssumptions: z.array(z.string()),
          })
          .optional()
          .nullable(),
        refinementSuggestion: z.string().optional().nullable(),
      }),
    )
    .max(100),
});

export const SocraticServerResponseSchema = z.object({
  move: SocraticMoveEnum,
  dialogue: z.string().trim().min(1).max(1200),
  workingQuestion: z.string().trim().min(5).max(300),
  thoughtNodeText: z.string().trim().max(300).optional().nullable(),
  thoughtNodeKind: z
    .enum([
      "initial",
      "clarification",
      "assumption",
      "tested",
      "reflection",
      "refinement",
    ])
    .optional()
    .nullable(),
  thoughtNodeSource: z.enum(["user", "socrates"]).optional().nullable(),
  thoughtNodeStatus: z.enum(["stated", "confirmed", "suggestion"]).optional().nullable(),
  reflectionSummary: z.string().max(600).optional().nullable(),
  reflectionConfirmedPoints: z.array(z.string().max(200)).optional().nullable(),
  reflectionOpenAssumptions: z.array(z.string().max(200)).optional().nullable(),
  refinementSuggestion: z.string().max(400).optional().nullable(),
  confirmedStance: z.string().max(400).optional().nullable(),
});
