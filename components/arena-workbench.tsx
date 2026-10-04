"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent } from "react";
import {
  DEFAULT_ACTIVE_IDS,
  DEFAULT_QUESTION,
  findPendingReply,
  THINKER_IDS,
  THINKER_LIST,
  THINKERS,
  makeDemoTurn,
  type ArenaAction,
  type ArenaTurn,
  type CardType,
  type LensReflectionResult,
  type RelationType,
  type ThinkerId,
  type XRayResult,
  type XRayAnalysisState,
  type XRayDiagnostics,
} from "@/lib/arena";
import { MLN_CONCEPTS_BY_ID } from "@/lib/mln111-concepts";

type Screen = "setup" | "session" | "xray" | "lens";
type TeamMode = "auto" | "custom" | "full";
type RequestKind = "start" | "continue" | "contribute" | "ask" | "challenge" | "invite" | "xray" | "reflect";

const ACTION_LABEL: Record<ArenaAction, string> = {
  frame: "LÀM RÕ CÂU HỎI",
  opening: "LĂNG KÍNH BAN ĐẦU",
  challenge: "PHẢN BIỆN",
  response: "HỒI ĐÁP",
  connection: "NỐI CÁC LĂNG KÍNH",
  clarify: "LÀM RÕ",
  invite: "LĂNG KÍNH MỚI",
  reflection: "TỔNG KẾT",
};

const BUSY_LABEL: Record<RequestKind, string> = {
  start: "Hội đồng đang vào cuộc…",
  continue: "Hội đồng đang nối tiếp cuộc trao đổi…",
  contribute: "Một triết gia đang hồi đáp ý kiến…",
  ask: "Một triết gia đang cân nhắc câu hỏi…",
  challenge: "Đang chuẩn bị lượt phản biện…",
  invite: "Đang mời thêm một góc nhìn…",
  xray: "Đang đối chiếu lập luận với khái niệm…",
  reflect: "Đang gợi ý nhìn lại lập trường của bạn…",
};

const CARD_LABEL: Record<CardType, string> = {
  QUESTION: "CÂU HỎI",
  CLAIM: "LẬP LUẬN",
  CHALLENGE: "THỬ THÁCH",
  DISTINCTION: "PHÂN BIỆT",
  TEST: "KIỂM CHỨNG",
  CONNECTION: "MỐI LIÊN HỆ",
  REFLECTION: "TỔNG HỢP",
};

const RELATION_LABEL: Record<Exclude<RelationType, "none">, string> = {
  conflict: "MÂU THUẪN",
  tension: "CĂNG THẲNG",
  complement: "BỔ SUNG",
  "different-levels": "KHÁC TẦNG",
};

function createId() {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isThinkerId(value: unknown): value is ThinkerId {
  return typeof value === "string" && (THINKER_IDS as readonly string[]).includes(value);
}

function toTurn(
  value: Omit<ArenaTurn, "id" | "role">,
): ArenaTurn {
  return {
    ...value,
    id: createId(),
    role: value.speakerId ? "thinker" : "moderator",
  };
}

function TurnGlyph({ action }: { action: ArenaAction }) {
  const symbols: Record<ArenaAction, string> = {
    frame: "◇",
    opening: "◌",
    challenge: "↗",
    response: "↘",
    connection: "∞",
    clarify: "?",
    invite: "+",
    reflection: "∴",
  };
  return <span aria-hidden="true" className="turn-glyph">{symbols[action]}</span>;
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function ThinkerPortrait({
  id,
  className = "",
}: {
  id: ThinkerId;
  className?: string;
}) {
  return (
    <span className={"thinker-portrait " + className}>
      <Image
        src={"/images/thinkers/" + id + ".webp"}
        alt=""
        width={480}
        height={480}
        sizes="(max-width: 650px) 46px, 88px"
      />
    </span>
  );
}

function ThinkerButton({
  id,
  active,
  speaking,
  reacting,
  selected,
  onClick,
}: {
  id: ThinkerId;
  active: boolean;
  speaking: boolean;
  reacting: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const thinker = THINKERS[id];
  return (
    <button
      className={`thinker-seat thinker-${id}${active ? " is-active" : " is-observer"}${speaking ? " is-speaking" : ""}${reacting ? " is-reacting" : ""}${selected ? " is-selected" : ""}`}
      onClick={onClick}
      type="button"
      aria-pressed={selected}
      aria-label={`${thinker.fullName}, ${active ? "đang tham gia" : "đang quan sát"}${speaking ? ", đang phát biểu" : ""}${reacting ? ", đang được nhắc tới trong lượt này" : ""}. Chọn để xem tương tác.`}
      title={`${thinker.fullName} · ${thinker.lens}`}
    >
      <ThinkerPortrait id={id} className="thinker-seat-portrait" />
      <span className="thinker-copy">
        <span className="thinker-name">{thinker.name}</span>
        <span className="thinker-lens">{thinker.lens}</span>
      </span>
    </button>
  );
}

export function ArenaWorkbench({
  aiConfigured,
  onSwitchToSocratic,
}: {
  aiConfigured: boolean;
  onSwitchToSocratic?: () => void;
}) {
  const [screen, setScreen] = useState<Screen>("setup");
  const [question, setQuestion] = useState(DEFAULT_QUESTION);
  const [activeIds, setActiveIds] = useState<ThinkerId[]>(DEFAULT_ACTIVE_IDS);
  const [preferredThinkerId, setPreferredThinkerId] = useState<ThinkerId | null>(null);
  const [teamMode, setTeamMode] = useState<TeamMode>("auto");
  const [turns, setTurns] = useState<ArenaTurn[]>([]);
  const [selectedId, setSelectedId] = useState<ThinkerId | null>(null);
  const [draft, setDraft] = useState("");
  const [lensDraft, setLensDraft] = useState("");
  const [lensSaved, setLensSaved] = useState(false);
  const [lensReflection, setLensReflection] = useState<LensReflectionResult | null>(null);
  const [xray, setXray] = useState<XRayResult | null>(null);
  const [xrayMode, setXrayMode] = useState<"indexed" | "demo-preview" | null>(null);
  const [xrayAnalysisState, setXrayAnalysisState] = useState<XRayAnalysisState | null>(null);
  const [xrayDiagnostics, setXrayDiagnostics] = useState<XRayDiagnostics | null>(null);
  const [visibleXRayCount, setVisibleXRayCount] = useState(4);
  const [busy, setBusy] = useState<RequestKind | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentTurn = turns.at(-1) ?? null;
  const isDirectExchange = Boolean(
    currentTurn?.speakerId &&
    currentTurn.targetId &&
    ["challenge", "response", "clarify", "opening"].includes(currentTurn.action),
  );
  const pendingReplyTargetId = findPendingReply(turns)?.targetId ?? null;
  const speakingId = currentTurn?.speakerId ?? null;
  const reactingId = currentTurn?.targetId ?? null;
  const currentWorkingQuestion =
    [...turns].reverse().find((turn) => turn.workingQuestion?.trim())?.workingQuestion ?? question;
  const selectedThinker = selectedId ? THINKERS[selectedId] : null;
  const selectedIsActive = selectedId ? activeIds.includes(selectedId) : false;
  const xrayEvidence = (xray ?? [])
    .flatMap((match) => {
      const evidenceTurns = match.evidenceTurnIds
        .map((id) => turns.find((candidate) => candidate.id === id))
        .filter((turn): turn is ArenaTurn => Boolean(turn && (turn.role === "thinker" || turn.role === "user")));
      const concept = match.conceptId ? MLN_CONCEPTS_BY_ID[match.conceptId] : null;
      return evidenceTurns.length
        ? [{
            match,
            evidenceTurns,
            concept,
            title: match.sourceTitle,
            definition: concept?.definition ?? match.sourceExcerpt,
            source: concept?.source ?? match.sourceLocation,
          }]
        : [];
    });
  const argumentHistory = turns
    .filter((turn) => turn.cardType !== null && turn.cardText?.trim())
    .slice(-8);
  const lensEvidenceTurns = (lensReflection?.evidenceTurnIds ?? [])
    .map((id) => turns.find((turn) => turn.id === id))
    .filter((turn): turn is ArenaTurn => Boolean(turn && turn.role === "user"));

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  function addUserTurn(text: string): ArenaTurn {
    return {
      id: createId(),
      role: "user",
      speakerId: null,
      action: "reflection",
      targetId: null,
      dialogue: text,
      cardType: null,
      cardText: null,
      relation: null,
      nextStep: "continue",
    };
  }

  async function requestArena(
    kind: RequestKind,
    options: {
      speakerId?: ThinkerId | null;
      targetId?: ThinkerId | null;
      userInput?: string;
      activeIds?: ThinkerId[];
      autoSelect?: boolean;
    } = {},
  ) {
    setError("");
    setNotice("");
    setBusy(kind);
    const nextActiveIds = options.activeIds ?? activeIds;

    if (!aiConfigured) {
      if (kind === "reflect") {
        setLensReflection(null);
        setBusy(null);
        return;
      }

      if (kind === "xray") {
        setXray([]);
        setXrayMode("demo-preview");
        setXrayAnalysisState(null);
        setXrayDiagnostics(null);
        setScreen("xray");
        setBusy(null);
        return;
      }

      if (kind === "contribute") {
        if (options.userInput) {
          setTurns((previous) => [...previous, addUserTurn(options.userInput ?? "")]);
          setDraft("");
          setNotice("Ý kiến đã được thêm vào bản trình diễn. Bản này chưa có phản hồi AI theo nội dung mới.");
        }
        setBusy(null);
        return;
      }

      if (kind === "continue" && turns.at(-1)?.nextStep === "finish") {
        setNotice(
          "Bản xem trước đã đi hết nội dung dựng sẵn. Hãy cấu hình OPENAI_API_KEY để Hội đồng tiếp tục theo mạch cuộc trao đổi này.",
        );
        setBusy(null);
        return;
      }

      const turn = makeDemoTurn({
        kind: kind === "start" ? "start" : kind,
        question,
        turns,
        activeIds: nextActiveIds,
        selectedSpeakerId: options.speakerId,
        targetId: options.targetId,
      });
      if (kind === "invite") setActiveIds(nextActiveIds);
      setTurns((previous) => [...previous, turn]);
      if (kind === "start") setScreen("session");
      setBusy(null);
      return;
    }

    try {
      const response = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          question,
          activeIds: nextActiveIds,
          autoSelect: options.autoSelect ?? false,
          preferredThinkerId,
          selectedSpeakerId: options.speakerId ?? null,
          targetId: options.targetId ?? null,
          userInput: options.userInput,
          turns: (kind === "xray" ? turns : turns.slice(-32)).map((turn) => ({
            id: turn.id,
            role: turn.role,
            speakerId: turn.speakerId,
            action: turn.action,
            targetId: turn.targetId,
            nextStep: turn.nextStep,
            cardType: turn.cardType,
            cardText: turn.cardText,
            relation: turn.relation,
            workingQuestion: turn.workingQuestion,
            dialogue: turn.dialogue,
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Không gọi được AI. Hãy thử lại.");
      }

      if (kind === "xray") {
        setXray(result.result as XRayResult);
        setXrayMode("indexed");
        setXrayAnalysisState(result.analysisState);
        setXrayDiagnostics(result.diagnostics ?? null);
        setVisibleXRayCount(4);
        setScreen("xray");
        return;
      }

      if (kind === "reflect") {
        setLensReflection(result.result as LensReflectionResult);
        return;
      }

      if (kind === "start") {
        const selectedIds = Array.isArray(result.activeIds)
          ? result.activeIds.filter(isThinkerId)
          : [];
        const maxSelectedIds = teamMode === "auto" ? 4 : THINKER_IDS.length;
        const manualTeamIsPreserved =
          teamMode === "auto" ||
          (selectedIds.length === activeIds.length &&
            activeIds.every((id) => selectedIds.includes(id)));
        if (
          selectedIds.length < 2 ||
          selectedIds.length > maxSelectedIds ||
          new Set(selectedIds).size !== selectedIds.length ||
          !manualTeamIsPreserved ||
          (teamMode === "auto" && preferredThinkerId && !selectedIds.includes(preferredThinkerId))
        ) {
          throw new Error("Hội đồng chưa chọn được đội hình hợp lệ. Hãy thử mở Arena lại.");
        }
        setActiveIds(selectedIds);
      }

      if (kind === "invite") {
        const selectedIds = Array.isArray(result.activeIds)
          ? result.activeIds.filter(isThinkerId)
          : [];
        if (
          selectedIds.length !== nextActiveIds.length ||
          new Set(selectedIds).size !== selectedIds.length ||
          nextActiveIds.some((id) => !selectedIds.includes(id))
        ) {
          throw new Error("Hội đồng chưa xác nhận được lời mời. Hãy thử lại.");
        }
        setActiveIds(selectedIds);
      }

      if (kind === "contribute" && options.userInput) {
        const userTurn = addUserTurn(options.userInput);
        const aiTurn = toTurn(result.turn as Omit<ArenaTurn, "id" | "role">);
        setTurns((previous) => [...previous, userTurn, aiTurn]);
        setDraft("");
      } else {
        const aiTurn = toTurn(result.turn as Omit<ArenaTurn, "id" | "role">);
        setTurns((previous) => [...previous, aiTurn]);
      }

      if (kind === "start") setScreen("session");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không gọi được AI lúc này. Hãy thử lại.",
      );
    } finally {
      setBusy(null);
    }
  }

  function toggleThinker(id: ThinkerId) {
    setTeamMode("custom");
    setActiveIds((current) => {
      if (current.includes(id)) {
        if (current.length <= 2) return current;
        return current.filter((candidate) => candidate !== id);
      }
      if (current.length >= THINKER_IDS.length) return current;
      return [...current, id];
    });
  }

  function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question.trim().length < 8 || activeIds.length < 2) return;
    setTurns([]);
    setXray(null);
    setXrayMode(null);
    setXrayAnalysisState(null);
    setXrayDiagnostics(null);
    setSelectedId(null);
    setLensDraft("");
    setLensSaved(false);
    setLensReflection(null);
    void requestArena("start", { autoSelect: teamMode === "auto" });
  }

  function handleUserTurn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    void requestArena("contribute", { userInput: message });
  }

  function handleInvite(id: ThinkerId) {
    const nextActive = activeIds.includes(id) ? activeIds : [...activeIds, id];
    setSelectedId(id);
    void requestArena("invite", { speakerId: id, activeIds: nextActive });
  }

  function returnToObserver(id: ThinkerId) {
    if (activeIds.length <= 2 || pendingReplyTargetId === id) return;
    setActiveIds((current) => current.filter((candidate) => candidate !== id));
    setSelectedId(null);
    setNotice(`${THINKERS[id].name} lùi về quan sát; bạn có thể mời lại sau.`);
  }

  function resetSession() {
    setScreen("setup");
    setQuestion(DEFAULT_QUESTION);
    setActiveIds(DEFAULT_ACTIVE_IDS);
    setPreferredThinkerId(null);
    setTeamMode("auto");
    setTurns([]);
    setSelectedId(null);
    setDraft("");
    setLensDraft("");
    setLensSaved(false);
    setLensReflection(null);
    setXray(null);
    setXrayMode(null);
    setXrayAnalysisState(null);
    setXrayDiagnostics(null);
    setError("");
    setNotice("");
    setBusy(null);
  }

  function saveLens(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lensDraft.trim()) return;
    setLensDraft(lensDraft.trim());
    setLensSaved(true);
  }

  function openYourLens() {
    setScreen("lens");
    setLensReflection(null);
    if (aiConfigured && turns.some((turn) => turn.role === "user")) {
      void requestArena("reflect");
    }
  }

  const header = (
    <header className="site-header">
      <button className="brand brand-button" type="button" onClick={resetSession}>
        <BrandMark />
        <span className="brand-wordmark">LĂNG KÍNH</span>
      </button>
      <div className="header-center">
        {onSwitchToSocratic ? (
          <div className="inline-flex rounded-full bg-[var(--paper-deep)] p-1 border border-[var(--line)]">
            <button className="px-4 py-1.5 text-xs font-semibold rounded-full bg-[var(--green)] text-white shadow-sm">
              🏛️ Arena Hội Đồng
            </button>
            <button
              onClick={onSwitchToSocratic}
              className="px-4 py-1.5 text-xs font-semibold rounded-full text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
            >
              🔍 Socratic Mode
            </button>
          </div>
        ) : (
          <>
            <span className="header-rule" />
            <span>AI PHILOSOPHY LAB</span>
            <span className="header-rule" />
          </>
        )}
      </div>
      <div className={`connection-status${aiConfigured ? " is-live" : " is-demo"}`}>
        <span className="status-dot" />
        {aiConfigured ? "AI READY" : "DEMO MODE"}
      </div>
    </header>
  );

  const dialoguePanel = (
    <div
      className={"dialogue-panel" + (isDirectExchange ? " has-direct-exchange" : "")}
      aria-live="polite"
    >
      <div className="dialogue-panel-top">
        <span className="phase-label">
          {currentTurn ? ACTION_LABEL[currentTurn.action] : "LĂNG KÍNH BAN ĐẦU"}
        </span>
        <span className={"ai-indicator" + (aiConfigured ? "" : " is-demo")}>
          <i />{aiConfigured ? "AI DIALOGUE" : "SCRIPTED PREVIEW"}
        </span>
      </div>
      {currentTurn?.speakerId &&
        currentTurn.targetId &&
        ["challenge", "response", "clarify", "opening"].includes(currentTurn.action) && (
          <div className="direct-exchange" aria-label="Hai phía trong lượt đối thoại trực tiếp">
            <div className="direct-exchange-person is-current-speaker">
              <ThinkerPortrait id={currentTurn.speakerId} className="exchange-portrait" />
              <span>{THINKERS[currentTurn.speakerId].name}</span>
            </div>
            <div className="direct-exchange-link">
              <span>
                {currentTurn.action === "challenge"
                  ? "THÁCH THỨC"
                  : currentTurn.action === "response"
                    ? "TRẢ LỜI"
                    : currentTurn.action === "opening"
                      ? "LẬP TRƯỜNG HƯỚNG TỚI"
                      : "CÂU HỎI TRỰC TIẾP"}
              </span>
              <b aria-hidden="true">→</b>
            </div>
            <div className="direct-exchange-person is-addressed-speaker">
              <ThinkerPortrait id={currentTurn.targetId} className="exchange-portrait" />
              <span>{THINKERS[currentTurn.targetId].name}</span>
            </div>
          </div>
        )}
      {currentTurn ? (
        <>
          <div className="speaker-heading">
            <TurnGlyph action={currentTurn.action} />
            {currentTurn.speakerId && !isDirectExchange && (
              <ThinkerPortrait id={currentTurn.speakerId} className="speaker-portrait" />
            )}
            <div>
              <p className="eyebrow">{currentTurn.speakerId ? THINKERS[currentTurn.speakerId].lens : "THE ARENA"}</p>
               <h2>{currentTurn.speakerId
                 ? THINKERS[currentTurn.speakerId].name
                 : currentTurn.action === "connection"
                   ? "Điểm gặp giữa các lăng kính"
                   : "Ghi chú của Hội đồng"}</h2>
            </div>
            {currentTurn.relation && currentTurn.relation !== "none" && (
              <span className={"relation-chip relation-" + currentTurn.relation}>
                {RELATION_LABEL[currentTurn.relation]}
              </span>
            )}
            {currentTurn.targetId && !isDirectExchange && (
              <span className="target-chip">→ {THINKERS[currentTurn.targetId].name}</span>
            )}
          </div>
          <blockquote className="dialogue-text">{currentTurn.dialogue}</blockquote>
          {currentTurn.cardText && currentTurn.cardType && (
            <div className={"argument-card card-" + currentTurn.cardType.toLowerCase()}>
              <span>{CARD_LABEL[currentTurn.cardType]}</span>
              <strong>{currentTurn.cardText}</strong>
            </div>
          )}
          <p className="simulation-note">Lời thoại mô phỏng các lăng kính tư tưởng, không phải trích dẫn nguyên văn.</p>
        </>
      ) : (
        <div className="dialogue-empty">
          <span className="empty-mark">◇</span>
          <p>Cuộc đối thoại sẽ bắt đầu từ câu hỏi của bạn.</p>
        </div>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {notice && <p className="inline-notice" role="status">{notice}</p>}
      <div className="dialogue-actions">
        <button
          type="button"
          className="button-primary button-continue"
          onClick={() => void requestArena(currentTurn ? "continue" : "start")}
          disabled={busy !== null}
        >
          {currentTurn?.nextStep === "invite_user"
            ? "Tiếp tục cùng Hội đồng"
            : currentTurn?.nextStep === "finish"
              ? "Tiếp tục thảo luận"
              : "Tiếp tục"}
          <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          className="ask-everyone"
          onClick={() => void requestArena("ask")}
          disabled={busy !== null || Boolean(pendingReplyTargetId)}
          title={pendingReplyTargetId ? "Hãy để người được hỏi trả lời lượt đang chờ trước." : undefined}
        >
          Ask the Council
        </button>
        {busy && (
          <span className="turn-progress" role="status">
            <i aria-hidden="true" />
            {BUSY_LABEL[busy]}
          </span>
        )}
      </div>
    </div>
  );

  if (screen === "setup") {
    return (
      <main className="app-shell setup-shell">
        {header}
        <section className="setup-hero">
          <div className="hero-copy">
            <p className="eyebrow"><span>01</span> · PHILOSOPHY ARENA</p>
            <h1>Đặt một vấn đề<br />lên bàn.</h1>
            <p className="hero-description">
              Sáu nhà tư tưởng cùng hiện diện. Một vài lăng kính sẽ lần lượt lên tiếng.
              Bạn có thể theo dõi và tham gia nếu muốn.
            </p>
            <div className="hero-note">
              <span className="note-star">✳</span>
              <span>Không có đáp án được tuyên sẵn.<br />Chỉ có những câu hỏi đáng để nghĩ tiếp.</span>
            </div>
            <div className="hero-council-preview" role="img" aria-label="Sáu nhà tư tưởng của Arena">
              <span className="eyebrow">SÁU LĂNG KÍNH</span>
              <div className="hero-council-portraits">
                {THINKER_IDS.map((id) => (
                  <ThinkerPortrait key={id} id={id} className="hero-portrait" />
                ))}
              </div>
            </div>
          </div>

          <form className="setup-card" onSubmit={handleStart}>
            <div className="setup-card-head">
              <div>
                <p className="eyebrow">QUESTION ON THE TABLE</p>
                <h2>Bạn đang băn khoăn điều gì?</h2>
              </div>
              <span className="setup-index">A—01</span>
            </div>
            <label className="sr-only" htmlFor="arena-question">Câu hỏi của bạn</label>
            <textarea
              id="arena-question"
              className="question-input"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Nhập một câu hỏi mở..."
            />
            <div className="character-count">{question.length} / 600</div>

            <div className="team-heading">
              <div>
                <p className="eyebrow">THE COUNCIL</p>
                <h3>{teamMode === "auto" ? "Chọn lăng kính phù hợp" : "Ai sẽ mở đầu?"}</h3>
              </div>
            </div>
            <div className="team-mode-picker" role="group" aria-label="Chọn cách lập hội đồng">
              <button
                type="button"
                className={`team-mode-option${teamMode === "auto" ? " is-selected" : ""}`}
                aria-pressed={teamMode === "auto"}
                onClick={() => setTeamMode("auto")}
              >
                Hội đồng tự chọn
              </button>
              <button
                type="button"
                className={`team-mode-option${teamMode === "custom" ? " is-selected" : ""}`}
                aria-pressed={teamMode === "custom"}
                onClick={() => {
                  if (teamMode === "full") setActiveIds(DEFAULT_ACTIVE_IDS);
                  setTeamMode("custom");
                }}
              >
                Tôi tự chọn
              </button>
              <button
                type="button"
                className={`team-mode-option${teamMode === "full" ? " is-selected" : ""}`}
                aria-pressed={teamMode === "full"}
                onClick={() => {
                  setTeamMode("full");
                  setActiveIds([...THINKER_IDS]);
                }}
              >
                Full Council
              </button>
            </div>
            {teamMode === "auto" ? (
              <>
                <p className="team-choice-note">
                  {aiConfigured
                    ? "Hội đồng chọn 2–4 lăng kính bổ sung cho nhau. Nếu muốn giữ một người, hãy chọn họ bên dưới."
                    : "Bản xem trước dùng đội hình mẫu Socrates, Marx và Lenin; chọn đội hình tự động cần kết nối AI."}
                </p>
                <label className="preferred-thinker-control" htmlFor="preferred-thinker">
                  <span>Giữ một người trong hội đồng <i>Tuỳ chọn</i></span>
                  <select
                    id="preferred-thinker"
                    value={preferredThinkerId ?? ""}
                    disabled={!aiConfigured}
                    onChange={(event) => setPreferredThinkerId(isThinkerId(event.target.value) ? event.target.value : null)}
                  >
                    <option value="">Để hội đồng tự chọn</option>
                    {THINKER_LIST.map((thinker) => (
                      <option key={thinker.id} value={thinker.id}>{thinker.fullName}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <div className="setup-roster" aria-label="Chọn nhà tư tưởng tham gia">
                {THINKER_LIST.map((thinker) => {
                  const active = activeIds.includes(thinker.id);
                  return (
                    <button
                      className={`roster-option${active ? " is-picked" : ""}`}
                      key={thinker.id}
                      type="button"
                      onClick={() => toggleThinker(thinker.id)}
                      aria-pressed={active}
                    >
                      <ThinkerPortrait id={thinker.id} className="roster-portrait" />
                      <span className="roster-name">{thinker.name}</span>
                      <span className="roster-check" aria-hidden="true">{active ? "✓" : "+"}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="setup-card-bottom">
              <span>{teamMode === "auto" ? "Chọn số lens vừa đủ" : teamMode === "full" ? "Cả sáu cùng tham gia" : `${activeIds.length} lăng kính · tối thiểu 2`}</span>
              <button
                className="button-primary"
                type="submit"
                disabled={question.trim().length < 8 || (teamMode !== "auto" && activeIds.length < 2) || busy !== null}
              >
                {busy === "start" ? "ĐANG MỞ PHIÊN…" : "Mở Arena"}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            {error && <p className="inline-error" role="alert">{error}</p>}
            {!aiConfigured && (
              <p className="demo-caption">Phiên mẫu dùng lời thoại dựng sẵn để bạn xem luồng Arena.</p>
            )}
          </form>
        </section>
        <footer className="page-footer">
          <span>LĂNG KÍNH · MỘT VẤN ĐỀ, NHIỀU CÁCH NHÌN</span>
          <span>01 / 04 · QUESTION</span>
        </footer>
      </main>
    );
  }

  if (screen === "xray") {
    const hasMatch = xrayEvidence.length > 0;
    const demoPreview = xrayMode === "demo-preview";
    const invalidProposals = (xrayDiagnostics?.rejectedMatches ?? 0) + (xrayDiagnostics?.rejectedRoutes ?? 0);
    const visibleEvidence = xrayEvidence.slice(0, visibleXRayCount);
    const emptyCopies = {
      "insufficient-dialogue": { heading: "Chưa có lập luận để đối chiếu.", text: "Phiên mới có phần dẫn nhập của Hội đồng. Hãy để các triết gia nêu quan điểm hoặc góp ý nếu bạn muốn, rồi mở X-Ray.", detail: "Câu hỏi ban đầu và lời moderator không được dùng như bằng chứng thay cho cuộc thảo luận." },
      "no-source-candidates": { heading: "Chưa chọn được đoạn nguồn.", text: "Chưa truy hồi được đoạn phù hợp với lời bàn luận trong phiên. Chưa thể kết luận giáo trình không có nội dung liên quan.", detail: "Bạn có thể chạy lại sau khi cuộc thảo luận làm rõ luận điểm hoặc điều kiện hơn." },
      "invalid-proposals": { heading: "Chưa xác thực được đề xuất.", text: "Các đề xuất từ AI có trích dẫn hoặc tham chiếu không hợp lệ nên đã được ẩn.", detail: "Đây là lỗi đối chiếu trích dẫn, không phải kết luận rằng phiên thiếu nội dung triết học. Bạn có thể thử lại." },
      "no-supported-match": { heading: "Chưa tìm thấy liên hệ đủ căn cứ.", text: "Những đoạn nguồn được chọn chưa hỗ trợ một liên hệ đủ rõ với lập luận trong phiên.", detail: "Trùng chủ đề hoặc từ khóa chưa đủ để ghép khái niệm. Kết quả rỗng không chứng minh giáo trình không bàn tới vấn đề." },
      matched: { heading: "Chưa tìm thấy liên hệ đủ căn cứ.", text: "Chưa có bằng chứng để hiển thị.", detail: "Hãy chạy lại X-Ray sau khi phiên có thêm lời bàn luận." },
    };
    const emptyCopy = demoPreview
      ? { heading: "Đây là bản xem trước.", text: "Bản xem trước chưa đối chiếu giáo trình. Kết quả X-Ray chỉ có khi ứng dụng kết nối AI.", detail: "Bản trình diễn không hiển thị kết quả dựng sẵn như một phép phân tích thật." }
      : emptyCopies[xrayAnalysisState ?? "no-supported-match"];
    return (
      <main className="app-shell result-shell">
        {header}
        <section className="result-heading">
          <p className="eyebrow"><span>03</span> · PHILOSOPHY X-RAY</p>
          <h1>Đối chiếu cuộc thoại<br />với giáo trình.</h1>
          <p>{currentWorkingQuestion}</p>
          {xrayDiagnostics && (
            <p className="xray-coverage-note" role="status">
              Phiên có {xrayDiagnostics.evidenceTurns} lượt bàn luận. Chỉ mục tra cứu gồm nội dung cả ba chương.
              {xrayDiagnostics.candidateChapters.length > 0 && ` Đoạn nguồn được chọn thuộc Chương ${xrayDiagnostics.candidateChapters.join(", ")}.`}
            </p>
          )}
          {invalidProposals > 0 && hasMatch && (
            <p className="xray-validation-note" role="status">
              Đã ẩn {invalidProposals} đề xuất có trích dẫn hoặc tham chiếu không hợp lệ.
            </p>
          )}
          {(xrayDiagnostics?.duplicateMatches ?? 0) > 0 && (
            <p className="xray-coverage-note">Đã bỏ {xrayDiagnostics?.duplicateMatches} bản lặp của cùng liên hệ.</p>
          )}
        </section>
        <section className="xray-layout">
          {hasMatch ? visibleEvidence.map(({ match, evidenceTurns, title, definition, concept }, index) => (
            <article className="xray-pair" key={`${match.sourceUnitId}-${index}`}>
              <div className="xray-evidence-card">
                <div className="evidence-topline">
                  <span className="evidence-index">LẬP LUẬN · {String(index + 1).padStart(2, "0")}</span>
                  <span className="evidence-line" />
                  <span className="turn-glyph">◇</span>
                </div>
                {evidenceTurns.map((turn) => (
                  <div className="xray-evidence-turn" key={turn.id}>
                    <p className="evidence-speaker">
                      {turn.speakerId && <ThinkerPortrait id={turn.speakerId} className="evidence-portrait" />}
                      <span>{turn.speakerId ? THINKERS[turn.speakerId].name : "BẠN"}</span>
                    </p>
                    {match.evidenceQuotes.filter((item) => item.turnId === turn.id).map((item, quoteIndex) => <blockquote key={quoteIndex}>{item.quote}</blockquote>)}
                    <details className="xray-source-details">
                      <summary>Đọc cả lượt thoại</summary>
                      <p>{turn.dialogue}</p>
                    </details>
                  </div>
                ))}
              </div>
              <div className="xray-concept-card">
                <p className="eyebrow">MLN111 · {match.supportType === "direct" ? "LIÊN HỆ THEO ĐOẠN TRÍCH" : "LIÊN HỆ QUA DIỄN GIẢI"}</p>
                <span className="concept-symbol" aria-hidden="true">↔</span>
                <h2>{title}</h2>
                <div className="concept-why">
                  <span className="eyebrow">LOGIC TRIẾT HỌC · {match.reasoningPattern}</span>
                  <p>{match.whyItMatches}</p>
                </div>
                <div className="concept-detail">
                  <span className="eyebrow">ĐOẠN NGUỒN TRONG GIÁO TRÌNH</span>
                  {match.sourceCitations.map((citation) => (
                    <div className="xray-source-citation" key={citation.chunkId}>
                      {citation.quotes.map((quote, quoteIndex) => <blockquote className="xray-source-quote" key={quoteIndex}>{quote}</blockquote>)}
                      <details className="xray-source-details">
                        <summary>Đọc đoạn nguồn đầy đủ</summary>
                        <p>{citation.excerpt}</p>
                      </details>
                      <p className="source-note">Nguồn: {citation.sourceLocation}.</p>
                    </div>
                  ))}
                </div>
                {concept && definition !== match.sourceExcerpt && (
                  <div className="concept-detail">
                    <span className="eyebrow">KHÁI NIỆM LIÊN QUAN · {concept.title}</span>
                    <p className="concept-definition">{definition}</p>
                  </div>
                )}
                <div className="concept-detail">
                  <span className="eyebrow">VÍ DỤ MINH HỌA MỚI</span>
                  <p className="concept-definition">{match.everydayExample}</p>
                </div>
              </div>
            </article>
          )) : (
            <article className="xray-pair xray-no-match">
              <div className="xray-evidence-card">
                <div className="evidence-topline">
                  <span className="evidence-index">LẬP LUẬN · —</span>
                  <span className="evidence-line" />
                  <span className="turn-glyph">◇</span>
                </div>
                <p className="empty-evidence">{emptyCopy.text}</p>
              </div>
              <div className="xray-concept-card">
                <p className="eyebrow">{demoPreview ? "DEMO · CHƯA PHÂN TÍCH" : "TRẠNG THÁI ĐỐI CHIẾU"}</p>
                <span className="concept-symbol" aria-hidden="true">∅</span>
                <h2>{emptyCopy.heading}</h2>
                <p className="concept-definition">{emptyCopy.detail}</p>
              </div>
            </article>
          )}
        </section>
        {xrayEvidence.length > visibleXRayCount && (
          <div className="result-actions">
            <button className="button-secondary" type="button" onClick={() => setVisibleXRayCount((count) => count + 4)}>
              Xem thêm liên hệ · còn {xrayEvidence.length - visibleXRayCount}
            </button>
          </div>
        )}
        {hasMatch && (
          <section className="concept-map-panel" aria-label="Concept Map của phiên">
            <div className="concept-map-heading">
              <p className="eyebrow">SESSION CONCEPT MAP</p>
              <span>{visibleEvidence.length}/{xrayEvidence.length} liên hệ đang hiển thị</span>
            </div>
            <div className="concept-map-flow">
              <div className="map-node map-node-question">
                <span>QUESTION</span>
                <strong>{currentWorkingQuestion}</strong>
              </div>
              {visibleEvidence.map(({ match, evidenceTurns, title }, index) => (
                <div className="concept-map-branch" key={`${match.sourceUnitId}-${index}`}>
                  <div className="map-edge"><span>được luận bàn qua · {index + 1}</span><b aria-hidden="true">→</b></div>
                  <div className="map-node map-node-evidence">
                    <span>BẰNG CHỨNG · {evidenceTurns.map((turn) => turn.speakerId ? THINKERS[turn.speakerId].name : "BẠN").join(" · ")}</span>
                    <strong>{match.reasoningPattern}</strong>
                  </div>
                  <div className="map-edge"><span>{match.mapRelation}</span><b aria-hidden="true">→</b></div>
                  <div className="map-node map-node-concept">
                    <span>MLN111</span>
                    <strong>{title}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        <div className="result-actions">
          <button className="button-secondary" type="button" onClick={() => setScreen("session")}>← Trở lại Arena</button>
          <button className="button-primary" type="button" onClick={openYourLens}>Viết lập trường của bạn <span aria-hidden="true">↗</span></button>
        </div>
        <footer className="page-footer"><span>LĂNG KÍNH · PHILOSOPHY X-RAY</span><span>03 / 04 · CONCEPT</span></footer>
      </main>
    );
  }

  if (screen === "lens") {
    return (
      <main className="app-shell result-shell lens-shell">
        {header}
        <section className="lens-editorial">
          <div className="lens-overline"><span>04</span><span className="overline-rule" /> YOUR LENS</div>
          <h1>Sau cuộc đối thoại,<br />bạn nhìn vấn đề này<br /><em>như thế nào?</em></h1>
          <p className="lens-question">{question}</p>
          {error && <p className="inline-error" role="alert">{error}</p>}
          {busy === "reflect" && (
            <p className="lens-reflection-loading" role="status">Đang đọc lại những điều bạn đã nêu trong phiên…</p>
          )}
          {lensReflection?.reflection && (
            <section className="lens-reflection-card" aria-label="Gợi ý phản ánh lập trường của bạn">
              <div className="lens-reflection-heading">
                <span className="eyebrow">GỢI Ý TỪ LẬP LUẬN CỦA BẠN</span>
                <span>Không phải kết luận hay điểm số</span>
              </div>
              <blockquote>{lensReflection.reflection}</blockquote>
              {lensEvidenceTurns.length > 0 && (
                <details className="lens-evidence-details">
                  <summary>Dựa trên {lensEvidenceTurns.length} ý bạn đã nêu</summary>
                  <ul>
                    {lensEvidenceTurns.map((turn) => <li key={turn.id}>{turn.dialogue}</li>)}
                  </ul>
                </details>
              )}
              <button
                type="button"
                className="text-button lens-use-suggestion"
                onClick={() => {
                  setLensDraft(lensReflection.reflection ?? "");
                  setLensSaved(false);
                }}
              >
                Dùng gợi ý làm bản nháp ↗
              </button>
            </section>
          )}
          {lensReflection && !lensReflection.reflection && (
            <p className="lens-reflection-empty" role="status">Bạn chưa nêu đủ lập trường riêng để tạo gợi ý. Hãy viết theo cách hiểu hiện tại của bạn.</p>
          )}
          <form className="lens-form" onSubmit={saveLens}>
            <label htmlFor="your-lens">Lập trường hiện tại của bạn</label>
            <textarea
              id="your-lens"
              value={lensDraft}
              onChange={(event) => { setLensDraft(event.target.value); setLensSaved(false); }}
              maxLength={1000}
              rows={5}
              placeholder="Bạn đang nghĩ gì sau khi nhìn vấn đề qua các lăng kính?"
              required
            />
            <div className="lens-form-footer">
              <span>{lensDraft.length} / 1000</span>
              <button className="button-primary" type="submit">{lensSaved ? "ĐÃ LƯU LẬP TRƯỜNG" : "Lưu Your Lens"} <span aria-hidden="true">↗</span></button>
            </div>
          </form>
          {lensSaved && (
            <section className="before-after" aria-label="Góc nhìn trước và sau phiên Arena">
              <div className="before-after-status" role="status">
                <span className="saved-mark">✓</span>
                <div>
                  <span className="eyebrow">YOUR LENS SAVED</span>
                  <p>Vấn đề đã được nhìn lại qua các lăng kính và lập trường của bạn.</p>
                </div>
              </div>
              <div className="before-after-grid">
                <article>
                  <span>WHEN YOU ENTERED</span>
                  <p>{question}</p>
                </article>
                <span className="before-after-arrow" aria-hidden="true">→</span>
                <article>
                  <span>AFTER THE SESSION</span>
                  <p>{lensDraft}</p>
                </article>
              </div>
            </section>
          )}
          <div className="lens-bottom-actions">
            <button className="button-secondary" type="button" onClick={() => setScreen("xray")}>← X-Ray</button>
            <button className="text-button" type="button" onClick={resetSession}>Bắt đầu một vấn đề mới ↗</button>
          </div>
        </section>
        <footer className="page-footer"><span>LĂNG KÍNH · YOUR LENS</span><span>04 / 04 · REFLECTION</span></footer>
      </main>
    );
  }

  return (
    <main className="app-shell session-shell">
      {header}
      <div className="session-toolbar">
        <div className="session-title-block">
          <p className="eyebrow"><span>02</span> · PHILOSOPHY ARENA</p>
          <h1>Vấn đề trên bàn</h1>
        </div>
        <div className="session-toolbar-actions">
          <span className="turn-count">{turns.filter((turn) => turn.role !== "user").length.toString().padStart(2, "0")} LƯỢT</span>
          <button type="button" className="text-button" onClick={resetSession}>Phiên mới ↗</button>
        </div>
      </div>

      <section className="arena-layout" aria-label="Phiên đối thoại Arena">
        <div className="council-panel">
          <div className="council-panel-top">
            <span>THE COUNCIL</span>
            <span className="council-live"><i /> {activeIds.length} THAM GIA · {THINKER_IDS.length - activeIds.length} QUAN SÁT</span>
          </div>
          <div className={"council-stage" + (speakingId ? " has-speaker" : "")}>
            <div className="stage-ambient stage-ambient-one" />
            <div className="stage-ambient stage-ambient-two" />
            <div className="stage-orbit stage-orbit-outer" />
            <div className="stage-orbit stage-orbit-inner" />
            <div className="stage-question is-compact">
              <span className="question-overline">QUESTION ON THE TABLE</span>
              <span className="question-gem" aria-hidden="true">◇</span>
              <span className="stage-question-text">{question}</span>
              <span className="stage-question-rule" />
              <span className="stage-question-caption">MỘT VẤN ĐỀ · NHIỀU LĂNG KÍNH</span>
            </div>
            <div className={"council-seats" + (speakingId ? " has-spotlight" : "")}>
              {THINKER_IDS.map((id) => (
                <ThinkerButton
                  key={id}
                  id={id}
                  active={activeIds.includes(id)}
                  speaking={speakingId === id}
                  reacting={reactingId === id && reactingId !== speakingId}
                  selected={selectedId === id}
                  onClick={() => setSelectedId((current) => current === id ? null : id)}
                />
              ))}
            </div>
            {dialoguePanel}
          </div>
          <div className="council-caption">
            <span><i className="legend-dot legend-active" /> Đang phát biểu</span>
            <span><i className="legend-dot legend-observer" /> Đang quan sát</span>
            <span className="caption-hint">Chọn một nhân vật để tương tác</span>
          </div>
          {selectedThinker && (
            <div className="thinker-actions" aria-live="polite">
              <div className="thinker-actions-copy">
                <span className="eyebrow">{selectedIsActive ? "LENS SELECTED" : "OBSERVER SELECTED"}</span>
                <strong>{selectedThinker.fullName}</strong>
                <span>{selectedThinker.lens}</span>
              </div>
              {selectedIsActive ? (
                <>
                  <button
                    type="button"
                    className="mini-action"
                    disabled={busy !== null || Boolean(pendingReplyTargetId)}
                    title={pendingReplyTargetId ? "Hãy để người được hỏi trả lời lượt đang chờ trước." : undefined}
                    onClick={() => void requestArena("ask", { speakerId: selectedId })}
                  >
                    Ask
                  </button>
                  <button
                    type="button"
                    className="mini-action mini-action-warm"
                    disabled={busy !== null || Boolean(pendingReplyTargetId) || !activeIds.some((id) => id !== selectedThinker.id)}
                    title={pendingReplyTargetId ? "Hãy để người được hỏi trả lời lượt đang chờ trước khi mở lượt mới." : undefined}
                    onClick={() => {
                    const challenger = activeIds.find((id) => id !== selectedThinker.id) ?? null;
                    if (challenger) void requestArena("challenge", { speakerId: challenger, targetId: selectedThinker.id });
                    }}
                  >
                    Challenge {selectedThinker.name}
                  </button>
                  <button
                    type="button"
                    className="mini-action mini-action-observer"
                    disabled={busy !== null || activeIds.length <= 2 || pendingReplyTargetId === selectedId}
                    title={pendingReplyTargetId === selectedId ? "Hãy để persona này trả lời lượt đang chờ." : activeIds.length <= 2 ? "Arena cần giữ ít nhất hai người active." : "Đưa persona về trạng thái quan sát."}
                    onClick={() => selectedId && returnToObserver(selectedId)}
                  >
                    Tạm lùi
                  </button>
                </>
              ) : (
                <button type="button" className="mini-action mini-action-warm" disabled={busy !== null || Boolean(pendingReplyTargetId)} onClick={() => selectedId && handleInvite(selectedId)}>Invite to Arena</button>
              )}
            </div>
          )}
        </div>

        <aside className="session-support">
          {argumentHistory.length > 1 && (
            <details className="argument-history">
              <summary>
                <span>ARGUMENT TRAIL</span>
                <span>{argumentHistory.length} thẻ lập luận <i aria-hidden="true">＋</i></span>
              </summary>
              <ol>
                {argumentHistory.slice(0, -1).reverse().map((turn) => (
                  <li key={turn.id}>
                    <div>
                      <span>{CARD_LABEL[turn.cardType as CardType]}</span>
                      <span>{turn.speakerId ? THINKERS[turn.speakerId].name : "ARENA"}</span>
                    </div>
                    <p>{turn.cardText}</p>
                    {turn.workingQuestion && (
                      <p className="argument-history-question">
                        <span>Câu hỏi lúc này</span>{turn.workingQuestion}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
              <p className="argument-history-note">Thẻ mới nhất đang được hiển thị trong khung đối thoại.</p>
            </details>
          )}

          <form className={`user-entry${currentTurn?.nextStep === "invite_user" ? " is-invited" : ""}`} onSubmit={handleUserTurn}>
            <div className="user-entry-heading">
              <span className="your-turn-mark">Y</span>
              <div>
                <p className="eyebrow">
                  {currentTurn?.nextStep === "invite_user" ? "LỜI MỜI TÙY CHỌN" : "KHÁN GIẢ · TÙY CHỌN"}
                </p>
                <label htmlFor="user-thought">
                  {currentTurn?.nextStep === "invite_user"
                    ? "Bạn có muốn trả lời câu hỏi mở này?"
                    : "Bạn có thể góp ý nếu muốn"}
                </label>
              </div>
            </div>
            <textarea
              id="user-thought"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={1200}
              rows={3}
              placeholder="Đưa ra một ví dụ, phản biện một lập luận, hoặc nói điều bạn đang nghĩ…"
            />
            <div className="user-entry-bottom">
              <span>
                {currentTurn?.nextStep === "invite_user"
                  ? "Hoặc chọn “Tiếp tục cùng Hội đồng” để bỏ qua."
                  : "Hội đồng vẫn tiếp tục dù bạn không nhập gì."}
              </span>
              <button className="send-thought" type="submit" disabled={!draft.trim() || busy !== null} aria-label="Gửi ý kiến của bạn">{busy === "contribute" ? "ĐANG PHẢN HỒI…" : "Gửi"} <span aria-hidden="true">↗</span></button>
            </div>
          </form>

          <details className="transcript-details">
            <summary><span>TRANSCRIPT</span><span>{turns.length} lượt <i aria-hidden="true">＋</i></span></summary>
            {turns.length ? (
              <ol className="transcript-list">
                {turns.map((turn) => (
                  <li key={turn.id} className={turn.role === "user" ? "transcript-user" : ""}>
                    <span>{turn.role === "user" ? "BẠN" : turn.speakerId ? THINKERS[turn.speakerId].name : "ARENA"}</span>
                    <p>{turn.dialogue}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="transcript-empty">Các lượt xuất hiện tại đây khi phiên bắt đầu.</p>}
          </details>
        </aside>
      </section>

      <section className="session-bottom-bar">
        <div className="changed-question">
          <span className="eyebrow">WHAT CHANGED?</span>
          <span className="question-version">
            <i>Ban đầu</i>
            <strong>{question}</strong>
          </span>
          <span className="question-version is-current">
            <i>Hiện tại</i>
            <strong>{currentWorkingQuestion}</strong>
          </span>
        </div>
        <button type="button" className="button-secondary" onClick={() => void requestArena("xray")} disabled={busy !== null || turns.length === 0}>
          {busy === "xray" ? "ĐANG SOI CHIẾU…" : "Mở Philosophy X-Ray"} <span aria-hidden="true">↗</span>
        </button>
      </section>

      <footer className="page-footer"><span>LĂNG KÍNH · PHILOSOPHY ARENA</span><span>02 / 04 · DISCUSSION</span></footer>
    </main>
  );
}
