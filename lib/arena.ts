export const THINKER_IDS = [
  "socrates",
  "hegel",
  "feuerbach",
  "marx",
  "engels",
  "lenin",
] as const;

export type ThinkerId = (typeof THINKER_IDS)[number];

export interface Thinker {
  id: ThinkerId;
  name: string;
  fullName: string;
  lens: string;
  mark: string;
}

export const THINKERS: Record<ThinkerId, Thinker> = {
  socrates: {
    id: "socrates",
    name: "Socrates",
    fullName: "Socrates",
    lens: "Khái niệm & giả định",
    mark: "S",
  },
  hegel: {
    id: "hegel",
    name: "Hegel",
    fullName: "Georg W. F. Hegel",
    lens: "Quan hệ & vận động",
    mark: "H",
  },
  feuerbach: {
    id: "feuerbach",
    name: "Feuerbach",
    fullName: "Ludwig Feuerbach",
    lens: "Con người & đời sống",
    mark: "F",
  },
  marx: {
    id: "marx",
    name: "Marx",
    fullName: "Karl Marx",
    lens: "Điều kiện xã hội",
    mark: "M",
  },
  engels: {
    id: "engels",
    name: "Engels",
    fullName: "Friedrich Engels",
    lens: "Liên hệ & hệ thống",
    mark: "E",
  },
  lenin: {
    id: "lenin",
    name: "Lenin",
    fullName: "V. I. Lenin",
    lens: "Thực tiễn & kiểm chứng",
    mark: "L",
  },
};

export const THINKER_LIST = Object.values(THINKERS);

export const DEFAULT_ACTIVE_IDS: ThinkerId[] = [
  "socrates",
  "marx",
  "lenin",
];

export const DEFAULT_QUESTION =
  "AI có khiến sinh viên ngày càng lười suy nghĩ không?";

export const ARENA_ACTIONS = [
  "frame",
  "opening",
  "challenge",
  "response",
  "connection",
  "clarify",
  "invite",
  "reflection",
] as const;

export type ArenaAction = (typeof ARENA_ACTIONS)[number];

export const CARD_TYPES = [
  "QUESTION",
  "CLAIM",
  "CHALLENGE",
  "DISTINCTION",
  "TEST",
  "CONNECTION",
  "REFLECTION",
] as const;

export type CardType = (typeof CARD_TYPES)[number];

export const RELATION_TYPES = [
  "conflict",
  "tension",
  "complement",
  "different-levels",
  "none",
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];
export type NextStep = "continue" | "invite_user" | "finish";

export interface ArenaTurn {
  id: string;
  role: "thinker" | "user" | "moderator";
  speakerId: ThinkerId | null;
  action: ArenaAction;
  targetId: ThinkerId | null;
  dialogue: string;
  workingQuestion?: string | null;
  cardType: CardType | null;
  cardText: string | null;
  relation: RelationType | null;
  nextStep: NextStep;
}

export type ArenaTurnExcerpt = Pick<
  ArenaTurn,
  "id" | "role" | "speakerId" | "action"
> & { targetId?: ThinkerId | null; dialogue?: string };

export function findPendingReply<T extends ArenaTurnExcerpt>(
  turns: readonly T[],
): T | null {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const prompt = turns[index];
    const expectsReply =
      prompt.action === "challenge" ||
      ((prompt.action === "clarify" || prompt.action === "opening") && Boolean(prompt.targetId));
    if (
      !expectsReply ||
      prompt.role !== "thinker" ||
      !prompt.speakerId ||
      !prompt.targetId
    ) {
      continue;
    }

    const hasResponse = turns.slice(index + 1).some(
      (turn) =>
        turn.role === "thinker" &&
        turn.action === "response" &&
        turn.speakerId === prompt.targetId &&
        turn.targetId === prompt.speakerId,
    );

    if (!hasResponse) return prompt;
  }

  return null;
}

export interface XRayMatch {
  conceptId: string | null;
  sourceSectionId: string;
  sourceUnitId: string;
  sourceUnitIds: string[];
  sourceChunkId: string;
  sourceTitle: string;
  sourceQuote: string;
  evidenceTurnIds: string[];
  evidenceQuotes: Array<{ turnId: string; quote: string }>;
  sourceSpanIds: string[];
  evidenceSpanIds: string[];
  sourceCitations: Array<{ chunkId: string; unitId: string; title: string; quotes: string[]; excerpt: string; sourceLocation: string; file: string; lineStart: number; lineEnd: number; printedPageStart: number | null; printedPageEnd: number | null }>;
  reasoningPattern: string;
  mapRelation: string;
  whyItMatches: string;
  supportType: "direct" | "interpretive";
  everydayExample: string;
  sourceExcerpt: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  sourceLineStart: number;
  sourceLineEnd: number;
  sourceFile: string;
  sourceLocation: string;
}

export type XRayResult = XRayMatch[];

export type XRayAnalysisState = "matched" | "no-supported-match" | "no-source-candidates" | "insufficient-dialogue" | "invalid-proposals";

export interface XRayDiagnostics {
  totalSections: number;
  indexedSections: number;
  indexedUnits: number;
  indexedChunks: number;
  candidatePassages: number;
  candidateUnits: number;
  candidateChapters: number[];
  transcriptTurns: number;
  evidenceTurns: number;
  reviewedEvidenceTurns: number;
  modelBatches: number;
  modelCalls: number;
  semanticRoutes: number;
  rejectedRoutes: number;
  proposedMatches: number;
  rejectedMatches: number;
  duplicateMatches: number;
  rejectionReasons: Record<string, number>;
}

export interface LensReflectionResult {
  reflection: string | null;
  evidenceTurnIds: string[];
}

type DemoKind = "start" | "continue" | "ask" | "challenge" | "invite";

function makeTurn(
  turn: Omit<ArenaTurn, "id" | "role"> & { role?: ArenaTurn["role"] },
): ArenaTurn {
  return {
    ...turn,
    id: `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: turn.role ?? (turn.speakerId ? "thinker" : "moderator"),
  };
}

export function makeDemoTurn({
  kind,
  question,
  turns,
  activeIds,
  selectedSpeakerId,
  targetId,
}: {
  kind: DemoKind;
  question: string;
  turns: ArenaTurn[];
  activeIds: ThinkerId[];
  selectedSpeakerId?: ThinkerId | null;
  targetId?: ThinkerId | null;
}): ArenaTurn {
  const active = activeIds.length ? activeIds : DEFAULT_ACTIVE_IDS;
  const firstSpeaker = active[0] ?? "socrates";
  const openingIds = new Set(
    turns
      .filter((turn) => turn.action === "opening" || turn.action === "invite")
      .map((turn) => turn.speakerId)
      .filter((id): id is ThinkerId => id !== null),
  );
  const openings = openingIds.size;
  const hasConnection = turns.some((turn) => turn.action === "connection");
  const workingQuestion =
    [...turns].reverse().find((turn) => turn.workingQuestion?.trim())?.workingQuestion ??
    (question.trim().length <= 320 ? question.trim() : `${question.trim().slice(0, 317)}…`);

  function demoTurn(
    turn: Omit<ArenaTurn, "id" | "role"> & { role?: ArenaTurn["role"] },
  ) {
    const result = makeTurn(turn);
    return { ...result, workingQuestion: result.workingQuestion ?? workingQuestion };
  }

  const pendingReply = findPendingReply(turns);

  if (
    kind === "continue" &&
    pendingReply?.speakerId &&
    pendingReply.targetId
  ) {
    return demoTurn({
      speakerId: pendingReply.targetId,
      targetId: pendingReply.speakerId,
      action: "response",
      dialogue:
        "Tôi sẽ trả lời trực tiếp điểm vừa được nêu. Một điều kiện có thể khiến xu hướng nào đó dễ xảy ra hơn, nhưng chưa chứng minh nó quyết định mọi trường hợp; cần xét hoàn cảnh cụ thể và khả năng hành động của từng người.",
      cardType: "CLAIM",
      cardText: "Điều kiện định hình lựa chọn nhưng không tự xóa bỏ khác biệt cá nhân.",
      relation: "tension",
      nextStep: "continue",
    });
  }

  if (kind === "continue" && turns.at(-1)?.nextStep === "invite_user") {
    return demoTurn({
      speakerId: null,
      targetId: null,
      action: "reflection",
      dialogue:
        "Hội đồng đã đặt các lăng kính chính cạnh nhau: một số điểm đã sáng rõ, còn kết luận về tác động thực tế vẫn cần thêm bằng chứng. Ta có thể dừng ở phân biệt đó mà không cần người xem phải trả lời.",
      cardType: "REFLECTION",
      cardText: "Phân biệt lập luận hiện có với điều còn cần kiểm chứng.",
      relation: "none",
      nextStep: "finish",
    });
  }

  if (kind === "start") {
    return demoTurn({
      speakerId: null,
      targetId: null,
      action: "frame",
      dialogue:
        "Trước khi đi tới kết luận, ta nên tách câu hỏi thành vài phần: khái niệm chính đang có nghĩa gì, điều kiện nào khiến hiện tượng xuất hiện, và ta có thể kiểm tra nhận định ấy trong thực tế ra sao?",
      cardType: "DISTINCTION",
      cardText: question,
      relation: "none",
      nextStep: "continue",
    });
  }

  if (kind === "ask") {
    const speakerId = selectedSpeakerId && active.includes(selectedSpeakerId)
      ? selectedSpeakerId
      : firstSpeaker;
    return demoTurn({
      speakerId,
      targetId: null,
      action: "clarify",
      dialogue: `Trong câu hỏi “${question}”, hãy xác định điều gì sẽ là dấu hiệu đủ rõ để ta nói rằng vấn đề đang được trả lời. Nếu tiêu chí chưa rõ, hai người có thể dùng cùng một từ nhưng nói về hai việc khác nhau.`,
      cardType: "QUESTION",
      cardText: "Ta đang dùng tiêu chí nào để trả lời?",
      relation: "none",
      nextStep: "continue",
    });
  }

  if (kind === "challenge") {
    const speakerId = selectedSpeakerId && active.includes(selectedSpeakerId)
      ? selectedSpeakerId
      : firstSpeaker;
    const resolvedTarget = targetId && targetId !== speakerId
      ? targetId
      : active.find((id) => id !== speakerId) ?? null;
    return demoTurn({
      speakerId,
      targetId: resolvedTarget,
      action: "challenge",
      dialogue:
        "Nếu ta chỉ nhìn vào một nguyên nhân, liệu có bỏ sót điều kiện khác đang cùng tác động không? Hãy thử nêu một trường hợp khiến nhận định vừa rồi cần được thu hẹp lại.",
      cardType: "CHALLENGE",
      cardText: "Một phản ví dụ có thể làm rõ giới hạn của nhận định.",
      relation: "tension",
      nextStep: "continue",
    });
  }

  if (kind === "invite") {
    const speakerId = selectedSpeakerId ?? "hegel";
    return demoTurn({
      speakerId,
      targetId: null,
      action: "invite",
      dialogue: `Một lăng kính ${THINKERS[speakerId].lens.toLowerCase()} có thể bổ sung câu hỏi: những yếu tố nào đang liên hệ với nhau, và chúng thay đổi theo thời gian ra sao?`,
      cardType: "CLAIM",
      cardText: `Góc nhìn mới · ${THINKERS[speakerId].lens}`,
      relation: "different-levels",
      nextStep: "continue",
    });
  }

  if (openings < active.length) {
    const speakerId = active[openings] ?? firstSpeaker;
    const openingText: Record<ThinkerId, string> = {
      socrates:
        "Trước khi kết luận về vấn đề này, ta cần thống nhất khái niệm chính và phân biệt một hành động cụ thể với hệ quả mà ta đang gán cho nó. Nếu không, ta có thể tưởng mình bất đồng dù đang nói về hai việc khác nhau.",
      hegel:
        "Một hiện tượng có thể tạo ra những hệ quả trái chiều tùy vào các quan hệ và điều kiện đi kèm. Ta nên xem những yếu tố ấy biến đổi lẫn nhau ra sao thay vì gọi tác động đơn giản là tốt hoặc xấu.",
      feuerbach:
        "Đừng chỉ giữ vấn đề ở mức khái niệm trừu tượng: hãy nhìn vào trải nghiệm, nhu cầu và quan hệ cụ thể của những người đang sống trong tình huống này. Ta cần biết điều gì đang hỗ trợ hoặc làm hạn chế những khả năng của họ.",
      marx:
        "Lựa chọn cá nhân diễn ra trong những điều kiện vật chất và xã hội cụ thể. Ta cần xem các nguồn lực, thiết chế và lợi ích đang cho phép hoặc hạn chế những lựa chọn nào, đồng thời không xóa bỏ năng lực hành động của từng người.",
      engels:
        "Hiện tượng này có thể hình thành từ nhiều quá trình cùng tác động và thay đổi theo thời gian. Ta cần chỉ ra cơ chế cụ thể giữa các yếu tố thay vì chỉ nói chung rằng chúng đều có liên quan.",
      lenin:
        question.trim() === DEFAULT_QUESTION
          ? "Nếu cho rằng AI làm suy yếu tư duy, ta cần nêu tiêu chí để kiểm tra nhận định đó. Một dấu hiệu có thể là người học còn tự vận dụng được điều đã học vào một nhiệm vụ mới sau khi không dùng AI hay không."
          : "Với một nhận định về tác động, ta cần nêu tiêu chí có thể kiểm tra và bằng chứng nào sẽ khiến mình phải điều chỉnh kết luận.",
    };
    return demoTurn({
      speakerId,
      targetId: null,
      action: "opening",
      dialogue: openingText[speakerId],
      cardType: speakerId === "lenin" ? "TEST" : "CLAIM",
      cardText: THINKERS[speakerId].lens,
      relation: "none",
      nextStep: "continue",
    });
  }

  const hasCouncilExchange = turns.some(
    (turn) => turn.role === "thinker" && (turn.action === "challenge" || turn.action === "response"),
  );

  if (!hasCouncilExchange && active.length >= 2) {
    const speakerId = active[0];
    const targetId = active[1];
    return demoTurn({
      speakerId,
      targetId,
      action: "challenge",
      dialogue: `${THINKERS[targetId].name}, cách giải thích vừa nêu có thể làm rõ một chiều của vấn đề, nhưng chưa đủ để kết luận yếu tố ấy quyết định mọi trường hợp. Ta cần phân biệt cơ chế được đề xuất với những điều kiện hoặc trường hợp ngoại lệ có thể làm thay đổi kết quả.`,
      cardType: "CHALLENGE",
      cardText: "Giải thích một xu hướng chưa chứng minh nó đúng với mọi cá nhân.",
      relation: "tension",
      nextStep: "continue",
    });
  }

  if (!hasConnection) {
    return demoTurn({
      speakerId: null,
      targetId: null,
      action: "connection",
      dialogue:
        "Các lăng kính vừa rồi đang bổ sung cho nhau: làm rõ khái niệm, xem xét điều kiện xã hội, rồi hỏi cách kiểm tra trong thực tế. Chúng nói ở các tầng khác nhau nên chưa cần ép thành một cuộc tranh cãi.",
      cardType: "CONNECTION",
      cardText: "Khái niệm · Điều kiện · Kiểm chứng",
      relation: "complement",
      nextStep: turns.some((turn) => turn.role === "user") ? "finish" : "invite_user",
    });
  }

  return demoTurn({
    speakerId: null,
    targetId: null,
    action: "reflection",
    dialogue:
      "Bản trình diễn đã đặt các góc nhìn chính lên bàn và nối những điểm bổ sung cho nhau. Bạn có thể tiếp tục theo dõi, chuyển sang X-Ray, hoặc góp ý nếu muốn.",
    cardType: "REFLECTION",
    cardText: "Phân biệt lập luận triết học với điều còn cần dữ liệu.",
    relation: "none",
    nextStep: "finish",
  });
}
