export type SocraticMove =
  | "definition"
  | "assumption"
  | "counterexample"
  | "consequence"
  | "distinction"
  | "reflection"
  | "refinement"
  | "clarification"
  | "example";

export interface ReflectionData {
  summary: string;
  confirmedPoints: string[];
  openAssumptions: string[];
}

export interface SocraticTurn {
  id: string;
  role: "user" | "socrates";
  text: string;
  move?: SocraticMove;
  inReplyToTurnId?: string;
  workingQuestion?: string;
  reflectionData?: ReflectionData | null;
  refinementSuggestion?: string | null;
  timestamp?: number;
}

export type ThoughtKind =
  | "initial"
  | "clarification"
  | "assumption"
  | "tested"
  | "reflection"
  | "refinement";

export type ThoughtStatus = "stated" | "confirmed" | "suggestion";

export interface ThoughtNode {
  id: string;
  sourceTurnIds: string[];
  source: "user" | "socrates";
  text: string;
  kind: ThoughtKind;
  status: ThoughtStatus;
}

export interface SocraticSession {
  id: string;
  topic: string;
  initialStance?: string;
  confirmedStance?: string;
  turns: SocraticTurn[];
  thoughtTrail: ThoughtNode[];
  status: "active" | "checkpoint" | "finished";
  pendingQuestion?: string;
  createdAt: number;
  updatedAt: number;
}

export type SocraticRequestKind =
  | "start"
  | "answer"
  | "ask_clarification"
  | "ask_example"
  | "checkpoint"
  | "confirm_refinement"
  | "finish";

export interface SocraticRequest {
  kind: SocraticRequestKind;
  topic: string;
  initialStance?: string;
  turns: SocraticTurn[];
  thoughtTrail: ThoughtNode[];
  userInput?: string;
  refinementText?: string;
}

export interface SocraticResponse {
  move: SocraticMove;
  dialogue: string;
  workingQuestion: string;
  thoughtNode?: Omit<ThoughtNode, "id"> | null;
  reflectionData?: ReflectionData | null;
  refinementSuggestion?: string | null;
  confirmedStance?: string | null;
  nextStatus?: "active" | "checkpoint" | "finished";
}

export const STORAGE_KEY_SOCRATIC = "philosophiarena_socratic_session_v1";

export function loadSocraticSession(): SocraticSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SOCRATIC);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SocraticSession;
    if (parsed && typeof parsed === "object" && parsed.id && Array.isArray(parsed.turns)) {
      return parsed;
    }
  } catch (err) {
    console.error("Failed to load socratic session from localStorage", err);
  }
  return null;
}

export function saveSocraticSession(session: SocraticSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_SOCRATIC, JSON.stringify(session));
  } catch (err) {
    console.error("Failed to save socratic session to localStorage", err);
  }
}

export function clearSocraticSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY_SOCRATIC);
  } catch (err) {
    console.error("Failed to clear socratic session", err);
  }
}

function createSocraticId(prefix: string = "soc") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Fallback / Mock Generator for Socratic Mode when OPENAI_API_KEY is not configured or in demo mode.
 */
export function makeSocraticDemoTurn(req: SocraticRequest): SocraticResponse {
  const { kind, topic, initialStance, turns, userInput, refinementText } = req;
  const userTurnsCount = turns.filter((t) => t.role === "user").length;

  if (kind === "start") {
    if (initialStance && initialStance.trim().length > 0) {
      return {
        move: "definition",
        dialogue: `Chào bạn. Tôi rất hoan nghênh câu hỏi "${topic}" và lập trường ban đầu của bạn: "${initialStance.trim()}". Để bắt đầu khảo sát suy nghĩ này, trước tiên ta cần làm rõ khái niệm cốt lõi. Theo bạn, khái niệm chính trong lập trường của bạn cụ thể hàm chứa những điều kiện nào?`,
        workingQuestion: "Bạn định nghĩa khái niệm cốt lõi trong lập trường của bạn cụ thể như thế nào?",
        thoughtNode: {
          sourceTurnIds: [],
          source: "user",
          text: `Quan điểm ban đầu: ${initialStance.trim()}`,
          kind: "initial",
          status: "stated",
        },
      };
    } else {
      return {
        move: "assumption",
        dialogue: `Chào bạn. Bạn đặt câu hỏi "${topic}" nhưng chưa nêu sẵn quan điểm ban đầu. Đây là một điểm khởi đầu tốt để cùng khám phá. Khi đối diện với câu hỏi này, giả định hoặc ý nghĩ đầu tiên nảy ra trong đầu bạn là gì?`,
        workingQuestion: "Khi đối diện câu hỏi này, giả định hoặc ý nghĩ đầu tiên của bạn là gì?",
      };
    }
  }

  if (kind === "ask_clarification") {
    const lastQuestion = [...turns].reverse().find((t) => t.workingQuestion)?.workingQuestion || "câu hỏi vừa rồi";
    return {
      move: "clarification",
      dialogue: `Ý tôi muốn làm rõ cho ${lastQuestion} là: Ta đang tìm xem tiêu chí bạn dùng để phán đoán nằm ở bản chất hành vi hay ở hệ quả thực tế. Bạn hãy thử xét xem khía cạnh nào quan trọng hơn đối với suy nghĩ của bạn.`,
      workingQuestion: `Quay lại câu hỏi: ${lastQuestion}`,
    };
  }

  if (kind === "ask_example") {
    const lastQuestion = [...turns].reverse().find((t) => t.workingQuestion)?.workingQuestion || "vấn đề đang bàn";
    return {
      move: "example",
      dialogue: `Hãy lấy một ví dụ thực tế: Giống như việc sử dụng bản đồ số (GPS). Nếu ta dùng GPS để đến nơi nhanh hơn nhưng vẫn biết rõ con đường, đó là công cụ hỗ trợ. Nhưng nếu ta đi theo GPS mà không còn nhớ đường hay quan sát xung quanh, đó là sự phụ thuộc. Áp dụng vào ${topic}, bạn thấy điểm tương đồng nào?`,
      workingQuestion: `Sau ví dụ trên, bạn đánh giá ra sao về câu hỏi: ${lastQuestion}?`,
    };
  }

  if (kind === "confirm_refinement") {
    const confirmed = refinementText || "Lập trường đã được tinh chỉnh theo sự thống nhất giữa người dùng và Socrates.";
    return {
      move: "reflection",
      dialogue: `Cảm ơn bạn đã xác nhận. Quan điểm của bạn hiện đã được diễn đạt rõ ràng và chặt chẽ hơn: "${confirmed}". Bạn có muốn tiếp tục khảo sát thêm một khía cạnh khác của vấn đề hay muốn tổng kết phiên thảo luận?`,
      workingQuestion: "Bạn muốn khảo sát thêm khía cạnh nào khác hay tổng kết phiên đối thoại?",
      confirmedStance: confirmed,
      thoughtNode: {
        sourceTurnIds: turns.map((t) => t.id).slice(-2),
        source: "user",
        text: confirmed,
        kind: "refinement",
        status: "confirmed",
      },
    };
  }

  if (kind === "checkpoint") {
    const userStatements = turns
      .filter((t) => t.role === "user")
      .map((t) => t.text)
      .slice(-3);
    const summaryStr = userStatements.length > 0
      ? `Qua các lượt vừa rồi, bạn đã làm rõ: ${userStatements.join(" | ")}.`
      : `Chúng ta đã khảo sát các khía cạnh định nghĩa và giả định của chủ đề "${topic}".`;

    return {
      move: "reflection",
      dialogue: `Chúng ta đã qua một số lượt đối thoại. Tôi xin tóm lược trung tính những gì bạn đã thể hiện: ${summaryStr}. Bạn có nhận thấy điểm nào cần bổ sung hoặc điều chỉnh trong bản tóm lược này không?`,
      workingQuestion: "Bản tóm lược trên đã phản ánh đúng suy nghĩ của bạn chưa?",
      reflectionData: {
        summary: summaryStr,
        confirmedPoints: userStatements.length > 0 ? userStatements : ["Khái niệm đã được làm rõ một phần"],
        openAssumptions: ["Cần kiểm tra thêm các trường hợp ngoại lệ trong thực tế"],
      },
      thoughtNode: {
        sourceTurnIds: turns.map((t) => t.id).slice(-3),
        source: "socrates",
        text: `Tóm lược đối thoại: ${summaryStr}`,
        kind: "reflection",
        status: "suggestion",
      },
      nextStatus: "checkpoint",
    };
  }

  if (kind === "finish") {
    const confirmed = req.initialStance || "Người dùng chưa đưa ra câu chốt cuối cùng.";
    return {
      move: "reflection",
      dialogue: `Phiên đối thoại Socratic về chủ đề "${topic}" đã hoàn thành. Bạn đã tự mình phân tích, làm rõ các khái niệm và kiểm tra các giả định ban đầu. Bạn có thể xem lại Thought Trail hoặc chuyển phiên đối thoại này sang Philosophy X-Ray để kiểm chứng học thuật.`,
      workingQuestion: "Phiên thảo luận kết thúc. Bạn có thể mở X-Ray hoặc khởi tạo phiên mới.",
      nextStatus: "finished",
    };
  }

  // General user answer handling: rotate through moves based on userTurnsCount
  const answerText = userInput?.trim() || "Tôi nghĩ là cần xem xét kỹ hơn.";
  
  if (userTurnsCount % 3 === 1) {
    // Assumption move
    return {
      move: "assumption",
      dialogue: `Khi bạn phát biểu rằng: "${answerText}", bạn đang dựa trên tiền đề nào? Có giả định ngầm định nào mà nếu thiếu nó thì khẳng định này không còn đứng vững?`,
      workingQuestion: "Tiền đề hay giả định ngầm định nào nằm đằng sau ý kiến vừa rồi của bạn?",
      thoughtNode: {
        sourceTurnIds: [createSocraticId("usr")],
        source: "user",
        text: answerText,
        kind: "clarification",
        status: "stated",
      },
    };
  } else if (userTurnsCount % 3 === 2) {
    // Counterexample move
    return {
      move: "counterexample",
      dialogue: `Ý kiến "${answerText}" rất đáng suy ngẫm. Hãy thử đặt trường hợp phản ví dụ sau: Giả sử có một tình huống mà điều bạn nêu xảy ra nhưng kết quả lại hoàn toàn ngược lại với dự đoán. Khi đó, lập trường của bạn sẽ giải thích thế nào?`,
      workingQuestion: "Trường hợp ngoại lệ vừa nêu có khiến bạn điều chỉnh giới hạn cho nhận định của mình không?",
      thoughtNode: {
        sourceTurnIds: [createSocraticId("usr")],
        source: "user",
        text: answerText,
        kind: "tested",
        status: "stated",
      },
    };
  } else {
    // Refinement move (suggestion)
    const suggestedRefinement = `Dựa trên những gì bạn phân biệt ("${answerText.slice(0, 80)}..."), ta có thể phát biểu lại lập trường một cách chặt chẽ hơn.`;
    return {
      move: "refinement",
      dialogue: `Qua câu trả lời vừa rồi, ta đã tiến gần hơn tới bản chất vấn đề. Tôi gợi ý cách tinh chỉnh lập trường của bạn như sau: "${suggestedRefinement}". Bạn thấy cách diễn đạt này có phản ánh đúng và chính xác hơn suy nghĩ của bạn không?`,
      workingQuestion: "Bạn có đồng ý tinh chỉnh quan điểm của mình theo câu gợi ý trên không?",
      refinementSuggestion: suggestedRefinement,
      thoughtNode: {
        sourceTurnIds: [createSocraticId("usr")],
        source: "socrates",
        text: `Đề xuất tinh chỉnh: ${suggestedRefinement}`,
        kind: "refinement",
        status: "suggestion",
      },
    };
  }
}
