import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import {
  ARENA_ACTIONS,
  CARD_TYPES,
  RELATION_TYPES,
  THINKER_IDS,
  THINKERS,
  findPendingReply,
  type ThinkerId,
} from "@/lib/arena";
import { PERSONA_SYSTEM_PROMPTS } from "@/lib/arena-prompts";
import { MLN_CONCEPTS } from "@/lib/mln111-concepts.server";
import {
  MLN_BOOK_CHUNKS_BY_ID,
  MLN_BOOK_INDEX,
  MLN_BOOK_SEARCH_INDEX,
  MLN_BOOK_UNITS_BY_ID,
} from "@/lib/mln111-book";
import { runMlnXRay, XRayAnalysisError } from "@/lib/mln111-xray-service.mjs";
import { MAX_XRAY_TRANSCRIPT_TURNS } from "@/lib/mln111-xray-contract.mjs";

const RequestSchema = z
  .object({
    kind: z.enum([
      "start",
      "continue",
      "contribute",
      "ask",
      "challenge",
      "invite",
      "xray",
      "reflect",
    ]),
    question: z.string().trim().min(8).max(600),
    activeIds: z.array(z.enum(THINKER_IDS)).min(2).max(6),
    autoSelect: z.boolean().default(false),
    preferredThinkerId: z.enum(THINKER_IDS).nullable().optional(),
    selectedSpeakerId: z.enum(THINKER_IDS).nullable().optional(),
    targetId: z.enum(THINKER_IDS).nullable().optional(),
    userInput: z.string().trim().max(1200).optional(),
    turns: z
      .array(
        z.object({
          id: z.string().min(1),
          role: z.enum(["thinker", "user", "moderator"]),
          speakerId: z.enum(THINKER_IDS).nullable(),
          action: z.enum(ARENA_ACTIONS),
          targetId: z.enum(THINKER_IDS).nullable().optional(),
          nextStep: z.enum(["continue", "invite_user", "finish"]).optional(),
          cardType: z.enum(CARD_TYPES).nullable().optional(),
          cardText: z.string().max(300).nullable().optional(),
          relation: z.enum(RELATION_TYPES).nullable().optional(),
          workingQuestion: z.string().max(320).optional(),
          dialogue: z.string().max(1800),
        }),
      )
      .max(MAX_XRAY_TRANSCRIPT_TURNS),
  })
  .refine((input) => new Set(input.activeIds).size === input.activeIds.length, {
    message: "Danh sách người tham gia bị lặp.",
  })
  .refine((input) => new Set(input.turns.map((turn) => turn.id)).size === input.turns.length, {
    message: "ID lượt thoại bị lặp.",
  });

const TurnSchema = z.object({
  participantIds: z.array(z.enum(THINKER_IDS)).min(2).max(6),
  speakerId: z.enum(THINKER_IDS).nullable(),
  targetId: z.enum(THINKER_IDS).nullable(),
  action: z.enum(ARENA_ACTIONS),
  dialogue: z.string().trim().min(1).max(1200),
  workingQuestion: z.string().trim().min(8).max(320),
  cardType: z.enum(CARD_TYPES).nullable(),
  cardText: z.string().trim().max(240).nullable(),
  relation: z.enum(RELATION_TYPES).nullable(),
  nextStep: z.enum(["continue", "invite_user", "finish"]),
});

const LensReflectionSchema = z.object({
  reflection: z.string().trim().min(1).max(1000).nullable(),
  evidenceTurnIds: z.array(z.string()).max(8),
});

const BASE_INSTRUCTIONS = `Bạn điều phối một phiên Arena giáo dục bằng tiếng Việt. Đây là đối thoại hư cấu lấy cảm hứng từ các lăng kính tư tưởng; tuyệt đối không trình bày lời do bạn tạo ra như trích dẫn thật của triết gia.

Quy tắc:
- Mỗi lượt làm đúng một việc tư duy, thường 2-4 câu ngắn.
- Arena trước hết là cuộc thảo luận giữa các triết gia: sau các opening lens ban đầu, mỗi lượt phải bám vào một luận điểm cụ thể vừa xuất hiện, trả lời, chất vấn, nối hoặc phân biệt nó bằng lăng kính riêng. Hãy gọi đúng tên người đang được trả lời/chất vấn khi hữu ích; không phát biểu lại như một bài mở đầu độc lập. Khi đặt câu hỏi trực tiếp cho một thinker, điền targetId của người đó và action=clarify; người được hỏi phải trả lời ở lượt tiếp theo.
- Người dùng chủ yếu theo dõi và không phải trả lời để phiên tiếp diễn hay kết thúc. Không hỏi người dùng ở mỗi lượt, không nhường lượt cho họ, và không đặt câu hỏi trực tiếp cho họ trừ lời mời mở tùy chọn ở gần cuối phiên.
- Chỉ đặt nextStep=invite_user khi đã có ít nhất hai lăng kính, các điểm chính và challenge đang chờ đã được xử lý, cuộc thảo luận gần khép lại, và còn một câu hỏi mở thật sự hữu ích cho người dùng. Khi mời, dialogue phải đặt rõ đúng một câu hỏi mở nhẹ nhàng, xưng hô trực tiếp với người đang theo dõi; không hỏi một thinker khác và không yêu cầu người dùng trả lời để Hội đồng tiếp diễn. Chỉ mời một lần; người dùng có thể trả lời hoặc bỏ qua. Có thể kết thúc bằng nextStep=finish dù người dùng chưa từng phát biểu.
- Tiếp nối nội dung đã có; không lặp lại ý của lượt trước.
- Không buộc phải tạo tranh cãi. Phân biệt mâu thuẫn, căng thẳng, bổ sung và khác tầng.
- Nếu action là challenge, relation chỉ được là conflict hoặc tension; nếu action là connection, relation phải là complement hoặc different-levels.
- Không khẳng định dữ kiện thực nghiệm nếu chưa có bằng chứng; hãy nói rõ điều gì cần được kiểm tra.
- Không phán người dùng đúng hoặc sai, không chấm điểm.
- workingQuestion phải là một câu hỏi ngắn phản ánh cách vấn đề đang được hiểu sau lượt này; giữ câu hỏi mở và không kết luận thay người dùng.
- participantIds phải giữ nguyên activeIds trong ngữ cảnh, trừ lượt start có autoSelect=true; khi đó chọn 2–4 id khác nhau từ danh sách ứng viên.
- Chỉ dùng speakerId nằm trong danh sách active, trừ yêu cầu invite đang mời một observer cụ thể.
- Trả lời bằng lời thoại tự nhiên, không nhắc đến schema hay quy trình kỹ thuật.`;

function makeTask(input: z.infer<typeof RequestSchema>) {
  const people = input.activeIds
    .map((id) => {
      const thinker = THINKERS[id];
      return `${thinker.name} (${thinker.id}): lăng kính ${thinker.lens}`;
    })
    .join("\n");
  const allThinkers = THINKER_IDS
    .map((id) => `${THINKERS[id].name} (${id}): ${THINKERS[id].lens}`)
    .join("\n");
  const openingIds = new Set(
    input.turns
      .filter((turn) => turn.action === "opening" || turn.action === "invite")
      .map((turn) => turn.speakerId)
      .filter((id): id is ThinkerId => id !== null),
  );
  const unspokenIds = input.activeIds.filter((id) => !openingIds.has(id));
  const openingCount = openingIds.size;
  const pendingReply = findPendingReply(input.turns);
  const userWasInvited = input.turns.some((turn) => turn.nextStep === "invite_user");
  const invitationWasSkipped =
    input.kind === "continue" && input.turns.at(-1)?.nextStep === "invite_user";
  const transcript = input.turns.map((turn) => {
      const name = turn.speakerId ? THINKERS[turn.speakerId].name : turn.role;
      const target = turn.targetId ? ` → ${THINKERS[turn.targetId].name}` : "";
      const card = turn.cardType && turn.cardText
        ? `\n  Thẻ ${turn.cardType}: ${turn.cardText}`
        : "";
      const relation = turn.relation && turn.relation !== "none"
        ? `; quan hệ=${turn.relation}`
        : "";
      const workingQuestion = turn.workingQuestion
        ? `\n  Câu hỏi đang được tinh chỉnh: ${turn.workingQuestion}`
        : "";
      return `[${turn.id}] ${name}${target}; hành động=${turn.action}${relation}: ${turn.dialogue}${card}${workingQuestion}`;
    })
    .join("\n");
  const selected = input.selectedSpeakerId
    ? THINKERS[input.selectedSpeakerId]
    : null;
  const target = input.targetId ? THINKERS[input.targetId] : null;
  const preferredThinker = input.preferredThinkerId
    ? THINKERS[input.preferredThinkerId]
    : null;

  const pendingReplyTask = pendingReply
    ? `Lượt ${pendingReply.action === "challenge" ? "challenge" : "câu hỏi trực tiếp"} của ${THINKERS[pendingReply.speakerId as ThinkerId].name} gửi ${THINKERS[pendingReply.targetId as ThinkerId].name} vẫn chưa được trả lời; lượt này phải để đúng người nhận phản hồi trực tiếp trước.`
    : "Không bỏ qua challenge hoặc câu hỏi trực tiếp gần nhất nếu đang có người chờ trả lời.";
  const openingTask = pendingReply
    ? "Ưu tiên để người nhận trả lời lượt đang chờ trước các opening còn thiếu."
    : unspokenIds.length
      ? `Mỗi thinker active cần nêu một opening ngắn trước khi bắt đầu phản biện. Hãy chọn một người chưa mở lời (${unspokenIds.map((id) => THINKERS[id].name).join(", ")}) trình bày lập trường ban đầu bằng phát biểu, không đặt câu hỏi hay hướng lượt tới thinker khác trong opening; không hỏi người dùng.`
      : "Các thinker active đều đã nêu lăng kính ban đầu; từ đây hãy đáp lại hoặc phản biện một luận điểm cụ thể của nhau, không quay lại mở bài độc lập. Nếu đặt câu hỏi trực tiếp cho một thinker, action=clarify và targetId phải là người được hỏi để người đó trả lời ngay ở lượt tiếp theo.";
  const invitationTask = userWasInvited
    ? "Lời mời tùy chọn đã xuất hiện trong phiên; không mời lại."
    : `Chỉ ở gần cuối, sau khi tất cả active thinker đã nêu lăng kính ban đầu, các điểm chính và challenge đã được xử lý, mới đặt nextStep=invite_user nếu còn một câu hỏi mở thật sự hữu ích. Cần tối thiểu bốn lượt của triết gia; nếu người dùng đã phát biểu thì không cần mời. Nếu chưa gần khép lại, dùng nextStep=continue; nếu không còn điều hữu ích để bàn, dùng nextStep=finish dù người dùng chưa nói.`;
  const continueTask = invitationWasSkipped
    ? `Người dùng đã bỏ qua lời mời tùy chọn vừa rồi; tuyệt đối không hỏi lại. ${pendingReplyTask} Nếu không còn lượt của thinker đang chờ trả lời, khép lại bằng một tổng kết ngắn nêu điểm đã được làm rõ và điều còn bỏ ngỏ, đặt nextStep=finish. Không cần chờ người dùng. participantIds giữ nguyên activeIds hiện tại.`
    : [
        "Tạo đúng một lượt tiếp theo và bám sát transcript.",
        pendingReplyTask,
        "Nếu người dùng vừa góp ý, phản hồi trực tiếp đúng điểm họ nêu.",
        `Đã có ${openingCount} opening lens; người active chưa mở lời: ${unspokenIds.map((id) => THINKERS[id].name).join(", ") || "không còn ai"}.`,
        openingTask,
        "Không mở rộng nhóm ngoài activeIds. Sau opening, chọn lượt theo luận điểm và nhu cầu của cuộc trao đổi, không xoay vòng máy móc.",
        "Chỉ challenge khi có bất đồng thật; nếu các lens bổ sung thì dùng connection; nếu chúng ở khác tầng thì phân biệt rồi nối hai tầng.",
        "workingQuestion phản ánh cách hiểu hiện tại; chỉ đổi khi lượt này thật sự làm rõ hoặc đổi trọng tâm.",
        invitationTask,
        "participantIds phải giữ nguyên activeIds hiện tại.",
      ].join(" ");

  const taskByKind: Record<typeof input.kind, string> = {
    start: input.autoSelect
      ? `Bắt đầu bằng Soft Frame của người điều phối: làm rõ cấu trúc câu hỏi, không trả lời thay người dùng. Đây chưa phải lời thoại của triết gia nên speakerId phải là null; action là frame, cardType là DISTINCTION, cardText là một câu hỏi ngắn làm rõ điểm cần phân biệt, workingQuestion là phiên bản câu hỏi đã được làm sáng tỏ nhưng vẫn để ngỏ, relation là none và nextStep là continue. Chọn participantIds gồm số người nhỏ nhất tạo được các lăng kính khác nhau (thường 2–3, tối đa 4) từ allThinkers. Người dùng yêu cầu giữ ${preferredThinker?.name ?? "không có ai cụ thể"}; nếu có yêu cầu, bắt buộc giữ người đó trong participantIds rồi chọn các lăng kính còn lại để bổ sung. Mỗi thinker được chọn sẽ nêu một opening ngắn trước khi họ trao đổi với nhau.`
      : "Bắt đầu bằng Soft Frame của người điều phối: làm rõ cấu trúc câu hỏi, không trả lời thay người dùng. Đây chưa phải lời thoại của triết gia nên speakerId phải là null; action là frame, cardType là DISTINCTION, cardText là một câu hỏi ngắn làm rõ điểm cần phân biệt, workingQuestion là phiên bản câu hỏi đã được làm sáng tỏ nhưng vẫn để ngỏ, relation là none và nextStep là continue. participantIds phải giữ nguyên activeIds đã được người dùng chọn.",
    continue: continueTask,
    contribute:
      "Phản hồi trực tiếp một điểm trong ý người dùng vừa nhập bằng một persona phù hợp, không gọi cả hội đồng trả lời. Không kết thúc bằng câu hỏi yêu cầu người dùng phản hồi thêm; nếu còn vấn đề cần hỏi, hướng câu hỏi tới một thinker khác để Hội đồng tiếp tục. action là response; không đặt nextStep=invite_user.",
    ask:
      `Trả lời yêu cầu hỏi từ lăng kính của ${selected?.name ?? "một người phù hợp"}. Không mở bài chung; đi thẳng vào câu hỏi và không đổi thành bài giảng.`,
    challenge:
      `Tạo một challenge có ích từ ${selected?.name ?? "một người phù hợp"}${target ? ` gửi tới ${target.name}` : ""}. Tấn công một tiền đề cụ thể, không bóp méo quan điểm và không dùng giọng thắng-thua. speakerId là người chất vấn, targetId là người nhận challenge, relation là conflict hoặc tension, nextStep phải là continue để người nhận có lượt trả lời ngay sau đó.`,
    invite:
      `Mời ${selected?.name ?? "một observer"} đưa vào một lăng kính mới chưa được xem xét. Không lặp lại các lens trước. action là invite.`,
    xray: "X-Ray uses its dedicated source-grounded analysis service.",
    reflect:
      "Chỉ đọc các lượt có role=user. Viết một gợi ý Your Lens ngắn, phản ánh điều người dùng thật sự đã nói, không lấy ý của triết gia làm lập trường của họ. Nêu rõ một sự phân biệt hoặc điều kiện mà họ tự đưa ra nếu có; không tự thêm kết luận. Nếu người dùng chưa nêu đủ ý riêng, reflection là null và evidenceTurnIds là mảng rỗng. Nếu có gợi ý, evidenceTurnIds chỉ gồm id của các lượt user làm căn cứ.",
  };

  return {
    task: taskByKind[input.kind],
    question: input.question,
    autoSelect: input.autoSelect,
    activeThinkers: people,
    allThinkers,
    preferredThinker: preferredThinker?.name ?? null,
        pendingReply: pendingReply
      ? {
          id: pendingReply.id,
          action: pendingReply.action,
          from: pendingReply.speakerId
            ? THINKERS[pendingReply.speakerId].name
            : null,
          to: pendingReply.targetId
            ? THINKERS[pendingReply.targetId].name
            : null,
          dialogue: input.turns.find((turn) => turn.id === pendingReply.id)?.dialogue ?? null,
        }
      : null,
    selectedSpeaker: selected?.name ?? null,
    targetSpeaker: target?.name ?? null,
    latestUserInput: input.userInput ?? null,
    transcript,
  };
}

function hasValidSpeaker(
  result: z.infer<typeof TurnSchema>,
  targetId: ThinkerId | null,
  input: z.infer<typeof RequestSchema>,
) {
  const { speakerId } = result;
  const pendingReply = input.kind === "continue"
    ? findPendingReply(input.turns)
    : null;

  if (input.kind === "start") {
    return (
      speakerId === null &&
      result.action === "frame" &&
      Boolean(result.workingQuestion.trim()) &&
      result.cardType === "DISTINCTION" &&
      Boolean(result.cardText?.trim()) &&
      result.relation === "none" &&
      result.nextStep === "continue"
    );
  }

  if (pendingReply) {
    if (
      !pendingReply.targetId ||
      !pendingReply.speakerId ||
      speakerId !== pendingReply.targetId ||
      result.action !== "response"
    ) {
      return false;
    }
    result.targetId = pendingReply.speakerId;
  }

  if (["ask", "challenge", "invite", "contribute"].includes(input.kind) && !speakerId) {
    return false;
  }
  if (speakerId === null) return true;
  if (!input.activeIds.includes(speakerId)) return false;

  if (
    ["ask", "challenge", "invite"].includes(input.kind) &&
    input.selectedSpeakerId &&
    speakerId !== input.selectedSpeakerId
  ) {
    return false;
  }

  if (input.kind === "ask" && result.action !== "clarify") return false;
  if (input.kind === "challenge" && result.action !== "challenge") return false;
  if (input.kind === "invite" && result.action !== "invite") return false;
  if (input.kind === "contribute" && result.action !== "response") return false;
  if (
    result.action === "challenge" &&
    result.relation !== "conflict" &&
    result.relation !== "tension"
  ) {
    return false;
  }
  if (
    result.action === "connection" &&
    result.relation !== "complement" &&
    result.relation !== "different-levels"
  ) {
    return false;
  }
  if (
    (result.action === "clarify" || result.action === "opening") &&
    targetId &&
    (targetId === speakerId || !input.activeIds.includes(targetId))
  ) {
    return false;
  }
  if (
    input.kind === "challenge" &&
    (!targetId || targetId === speakerId || !input.activeIds.includes(targetId) || result.nextStep !== "continue")
  ) {
    return false;
  }
  if (input.targetId && targetId !== input.targetId) return false;

  if (
    input.kind === "continue" &&
    pendingReply &&
    speakerId !== pendingReply.targetId
  ) {
    return false;
  }

  return true;
}

function hasValidParticipants(
  participantIds: ThinkerId[],
  input: z.infer<typeof RequestSchema>,
) {
  if (new Set(participantIds).size !== participantIds.length) return false;

  if (input.kind === "start" && input.autoSelect) {
    return (
      participantIds.length <= 4 &&
      (!input.preferredThinkerId || participantIds.includes(input.preferredThinkerId))
    );
  }

  return (
    participantIds.length === input.activeIds.length &&
    participantIds.every((id) => input.activeIds.includes(id))
  );
}

function inferDirectedThinkerTarget(
  turn: z.infer<typeof TurnSchema>,
  input: z.infer<typeof RequestSchema>,
) {
  if (
    input.kind !== "continue" ||
    (turn.action !== "clarify" && turn.action !== "opening") ||
    !turn.speakerId ||
    turn.targetId
  ) {
    return;
  }

  const dialogue = turn.dialogue.toLocaleLowerCase("vi");
  const hasQuestion = /[?？]/u.test(turn.dialogue);
  const namedTargets = input.activeIds.filter(
    (id) =>
      id !== turn.speakerId &&
      new RegExp(`\\b${THINKERS[id].name.toLocaleLowerCase("vi")}\\b`, "u").test(dialogue),
  );
  if (namedTargets.length === 0 && !hasQuestion) return;
  const possibleTargets = namedTargets.length > 0
    ? namedTargets
    : input.activeIds.filter((id) => id !== turn.speakerId);
  const mostRecentPossibleTarget = [...input.turns]
    .reverse()
    .find(
      (item) =>
        item.role === "thinker" &&
        item.speakerId !== null &&
        possibleTargets.includes(item.speakerId),
    )?.speakerId;
  turn.targetId = mostRecentPossibleTarget ?? (namedTargets.length === 1 ? namedTargets[0] : null);
}

function normalizeOptionalInvitation(
  turn: z.infer<typeof TurnSchema>,
  input: z.infer<typeof RequestSchema>,
) {
  const invitationWasAlreadyOffered = input.turns.some(
    (item) => item.nextStep === "invite_user",
  );
  const invitationWasSkipped =
    input.kind === "continue" && input.turns.at(-1)?.nextStep === "invite_user";
  const pendingReply = findPendingReply(input.turns);
  const replyIsRequired =
    Boolean(pendingReply) ||
    turn.action === "challenge" ||
    ((turn.action === "clarify" || turn.action === "opening") && Boolean(turn.targetId));
  const thinkerTurnCount = input.turns.filter((item) => item.role === "thinker").length;
  const openingIds = new Set(
    input.turns
      .filter((item) => item.action === "opening" || item.action === "invite")
      .map((item) => item.speakerId)
      .filter((id): id is ThinkerId => id !== null),
  );
  if ((turn.action === "opening" || turn.action === "invite") && turn.speakerId) {
    openingIds.add(turn.speakerId);
  }
  const allActiveThinkersOpened = input.activeIds.every((id) => openingIds.has(id));
  const exchangeActions = new Set(["challenge", "response", "connection"]);
  const councilHasExchangedViews =
    input.turns.some((item) => exchangeActions.has(item.action)) ||
    exchangeActions.has(turn.action);
  const userHasSpoken = input.turns.some((item) => item.role === "user");
  const invitationHasOpenQuestion = /[?？]/u.test(turn.dialogue);
  const invitationAddressesUser =
    /\b(?:bạn|em|anh|chị)\b|mọi người|người xem|người nghe|người dùng|người đang theo dõi/iu
      .test(turn.dialogue);

  if (
    turn.action === "challenge" ||
    ((turn.action === "clarify" || turn.action === "opening") && Boolean(turn.targetId))
  ) {
    turn.nextStep = "continue";
  }

  if (
    turn.nextStep === "finish" &&
    (!allActiveThinkersOpened || !councilHasExchangedViews)
  ) {
    turn.nextStep = "continue";
  }

  if (turn.nextStep === "invite_user") {
    const isLateOptionalInvitation =
      input.kind === "continue" &&
      !invitationWasAlreadyOffered &&
      !userHasSpoken &&
      !replyIsRequired &&
      allActiveThinkersOpened &&
      councilHasExchangedViews &&
      invitationHasOpenQuestion &&
      invitationAddressesUser &&
      thinkerTurnCount >= 4;
    if (!isLateOptionalInvitation) turn.nextStep = "continue";
  }

  if (invitationWasSkipped) {
    turn.nextStep = replyIsRequired ? "continue" : "finish";
  }
}

function personaInstructions(input: z.infer<typeof RequestSchema>) {
  if (input.kind === "xray" || input.kind === "reflect") return "";

  const pendingResponseTarget = input.kind === "continue"
    ? findPendingReply(input.turns)?.targetId
    : null;
  const designatedId = pendingResponseTarget ?? (
    ["ask", "challenge", "invite"].includes(input.kind) && input.selectedSpeakerId
      ? input.selectedSpeakerId
      : null
  );

  if (input.kind === "start") {
    return "Moderator lens: neutrally clarify the wording and assumptions in the question without speaking as a philosopher or giving a verdict.";
  }

  if (designatedId) {
    const thinker = THINKERS[designatedId];
    return `Persona system prompt — ${thinker.name} (${thinker.lens}):\n${PERSONA_SYSTEM_PROMPTS[designatedId]}`;
  }

  return `Persona system prompts for the active candidates:\n${input.activeIds
    .map((id) => {
      const thinker = THINKERS[id];
      return `### ${thinker.name} (${thinker.lens})\n${PERSONA_SYSTEM_PROMPTS[id]}`;
    })
    .join("\n\n")}`;
}

function validateLensReflection(
  result: z.infer<typeof LensReflectionSchema>,
  input: z.infer<typeof RequestSchema>,
) {
  const userTurnIds = new Set(
    input.turns.filter((turn) => turn.role === "user").map((turn) => turn.id),
  );
  const evidenceTurnIds = [...new Set(result.evidenceTurnIds)];

  if (
    !result.reflection ||
    evidenceTurnIds.length === 0 ||
    evidenceTurnIds.some((id) => !userTurnIds.has(id))
  ) {
    return { reflection: null, evidenceTurnIds: [] };
  }

  return { reflection: result.reflection, evidenceTurnIds };
}

const LENS_REFLECTION_INSTRUCTIONS = `Bạn giúp người dùng phản ánh lại lập trường của chính họ sau một phiên Arena.

Quy tắc:
- Chỉ dùng các lượt role=user làm bằng chứng cho quan điểm của người dùng; không gán lời của triết gia cho họ.
- Gợi ý ngắn, khiêm tốn, dùng cách nói như “Bạn đang phân biệt…” hoặc “Có vẻ bạn cho rằng…”.
- Không chấm đúng/sai, không đưa verdict, không thêm luận điểm mà người dùng chưa nói.
- Nếu người dùng chưa thực sự nêu lập trường riêng, trả reflection=null và evidenceTurnIds=[].
- Nếu có gợi ý, evidenceTurnIds phải là id thật của các lượt user trực tiếp hỗ trợ nội dung.`;

function reasoningEffortFor(input: z.infer<typeof RequestSchema>) {
  if (
    input.kind === "xray" ||
    input.kind === "continue" ||
    input.kind === "challenge" ||
    (input.kind === "start" && input.autoSelect)
  ) {
    return "medium" as const;
  }

  return "low" as const;
}

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "Chưa tìm thấy OPENAI_API_KEY trong file .env." },
      { status: 503 },
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  if (
    typeof rawBody === "object" && rawBody !== null &&
    "kind" in rawBody && rawBody.kind === "xray" &&
    "turns" in rawBody && Array.isArray(rawBody.turns) &&
    rawBody.turns.length > MAX_XRAY_TRANSCRIPT_TURNS
  ) {
    return Response.json(
      { error: `Phiên có hơn ${MAX_XRAY_TRANSCRIPT_TURNS} lượt thoại nên chưa thể đối chiếu trong một lần. Hãy tạo phiên ngắn hơn.` },
      { status: 413 },
    );
  }

  const parsedRequest = RequestSchema.safeParse(rawBody);
  if (!parsedRequest.success) {
    return Response.json(
      { error: "Hãy kiểm tra câu hỏi và nội dung vừa nhập." },
      { status: 400 },
    );
  }

  const input = parsedRequest.data;
  if (
    ["ask", "challenge", "invite"].includes(input.kind) &&
    findPendingReply(input.turns)
  ) {
    return Response.json(
      { error: "Hãy để người được hỏi trả lời lượt đang chờ trước khi mở một hướng mới." },
      { status: 409 },
    );
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  if (input.kind === "xray") {
    try {
      const analysis = await runMlnXRay(
        { question: input.question, turns: input.turns },
        { bookIndex: MLN_BOOK_INDEX, searchIndex: MLN_BOOK_SEARCH_INDEX, unitsById: MLN_BOOK_UNITS_BY_ID, chunksById: MLN_BOOK_CHUNKS_BY_ID, concepts: MLN_CONCEPTS },
        { client, model: process.env.AI_MODEL ?? "gpt-6-luna" },
      );
      return Response.json({ type: "xray", ...analysis });
    } catch (error) {
      return Response.json({ error: error instanceof XRayAnalysisError ? error.message : "X-Ray chưa hoàn tất đối chiếu. Hãy thử lại; phiên vẫn được giữ." }, { status: 502 });
    }
  }
  const task = makeTask(input);
  const personaPrompt = personaInstructions(input);
  const context = JSON.stringify(task);

  try {
    if (input.kind === "reflect") {
      const response = await client.responses.parse({
        model: process.env.AI_MODEL ?? "gpt-6-luna",
        reasoning: { effort: reasoningEffortFor(input) },
        store: false,
        instructions: `${LENS_REFLECTION_INSTRUCTIONS}\n\n${task.task}`,
        input: context,
        max_output_tokens: 400,
        text: { format: zodTextFormat(LensReflectionSchema, "your_lens_reflection") },
      });
      const result = response.output_parsed;
      if (!result) {
        return Response.json(
          { error: "Chưa tạo được gợi ý Your Lens. Bạn vẫn có thể tự viết lập trường." },
          { status: 502 },
        );
      }
      return Response.json({
        type: "reflection",
        result: validateLensReflection(result, input),
      });
    }


    const response = await client.responses.parse({
      model: process.env.AI_MODEL ?? "gpt-6-luna",
      reasoning: { effort: reasoningEffortFor(input) },
      store: false,
      instructions: `${BASE_INSTRUCTIONS}\n\n${personaPrompt}\n\n${task.task}\n\nDanh sách người đang hoạt động:\n${task.activeThinkers}\n\nDanh sách ứng viên của Hội đồng:\n${task.allThinkers}`,
      input: context,
      max_output_tokens: 1400,
      text: { format: zodTextFormat(TurnSchema, "arena_turn") },
    });
    const parsedTurn = response.output_parsed;
    if (!parsedTurn) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Arena response had no parsed turn", {
          kind: input.kind,
          status: response.status,
          incompleteReason: response.incomplete_details?.reason ?? null,
        });
      }
      return Response.json(
        {
          error: response.incomplete_details?.reason === "max_output_tokens"
            ? "AI chưa hoàn tất lượt thoại. Lượt trước vẫn được giữ; hãy thử lại."
            : "AI chưa tạo được lượt thoại hợp lệ. Lượt trước vẫn được giữ; hãy thử lại.",
        },
        { status: 502 },
      );
    }

    const result = {
      ...parsedTurn,
      participantIds: input.kind === "start" ? parsedTurn.participantIds : input.activeIds,
    };
    inferDirectedThinkerTarget(result, input);
    const speakerIsValid = hasValidSpeaker(result, result.targetId, input);
    const participantsAreValid = hasValidParticipants(result.participantIds, input);
    if (!speakerIsValid || !participantsAreValid) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Arena turn rejected by validation", {
          kind: input.kind,
          action: parsedTurn.action,
          speakerId: parsedTurn.speakerId,
          targetId: parsedTurn.targetId,
          activeIds: input.activeIds,
          pendingReplyId: input.kind === "continue"
            ? findPendingReply(input.turns)?.id ?? null
            : null,
          speakerIsValid,
          participantsAreValid,
        });
      }
      return Response.json(
        { error: "AI trả về lượt không khớp với diễn tiến hiện tại. Lượt trước vẫn được giữ; hãy thử lại." },
        { status: 502 },
      );
    }

    normalizeOptionalInvitation(result, input);
    const { participantIds, ...turn } = result;
    return Response.json({
      type: "turn",
      turn,
      activeIds: input.kind === "start" ? participantIds : input.activeIds,
    });
  } catch {
    return Response.json(
      { error: "Không gọi được AI lúc này. Hãy thử lại sau ít phút." },
      { status: 502 },
    );
  }
}
