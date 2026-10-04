"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  clearSocraticSession,
  loadSocraticSession,
  makeSocraticDemoTurn,
  saveSocraticSession,
  type ReflectionData,
  type SocraticMove,
  type SocraticRequestKind,
  type SocraticSession,
  type SocraticTurn,
  type ThoughtNode,
} from "@/lib/socratic";
import {
  MLN_CONCEPTS_BY_ID,
} from "@/lib/mln111-concepts";
import type { XRayAnalysisState, XRayDiagnostics, XRayResult } from "@/lib/arena";

const MOVE_LABELS: Record<SocraticMove, string> = {
  definition: "LÀM RÕ ĐỊNH NGHĨA",
  assumption: "NHẬN DIỆN GIẢ ĐỊNH",
  counterexample: "THỬ PHẢN VÍ DỤ",
  consequence: "KIỂM TRA HỆ QUẢ",
  distinction: "PHÂN BIỆT Ý NIỆM",
  reflection: "TỔNG KẾT PHẢN ÁNH",
  refinement: "TINH CHỈNH LẬP TRƯỜNG",
  clarification: "LÀM RÕ CÂU HỎI",
  example: "VÍ DỤ MINH HỌA",
};

interface SocraticWorkbenchProps {
  aiConfigured: boolean;
  onSwitchToArena?: () => void;
}

export function SocraticWorkbench({ aiConfigured, onSwitchToArena }: SocraticWorkbenchProps) {
  const [session, setSession] = useState<SocraticSession | null>(null);
  const [topicInput, setTopicInput] = useState("AI có khiến sinh viên ngày càng lười suy nghĩ không?");
  const [initialStanceInput, setInitialStanceInput] = useState("");
  const [userInput, setUserInput] = useState("");
  const [customRefinementInput, setCustomRefinementInput] = useState("");
  const [showCustomRefinement, setShowCustomRefinement] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // X-Ray integration states
  const [showXRayModal, setShowXRayModal] = useState(false);
  const [xrayState, setXRayState] = useState<XRayAnalysisState | "idle">("idle");
  const [xrayResults, setXRayResults] = useState<XRayResult>([]);
  const [xrayDiagnostics, setXRayDiagnostics] = useState<XRayDiagnostics | null>(null);
  const [xrayError, setXRayError] = useState<string | null>(null);
  const [isXRayLoading, setIsXRayLoading] = useState(false);
  const [expandedXRayCardId, setExpandedXRayCardId] = useState<string | null>(null);

  // Load saved session on mount
  useEffect(() => {
    const saved = loadSocraticSession();
    if (saved) {
      setSession(saved);
    }
  }, []);

  // Save session on updates
  useEffect(() => {
    if (session) {
      saveSocraticSession(session);
    }
  }, [session]);

  const handleStartSession = async (e: FormEvent) => {
    e.preventDefault();
    if (!topicInput.trim()) return;

    setIsBusy(true);
    setBusyLabel("Socrates đang lắng nghe vấn đề ban đầu…");
    setErrorMsg(null);

    const newSession: SocraticSession = {
      id: `soc-sess-${Date.now()}`,
      topic: topicInput.trim(),
      initialStance: initialStanceInput.trim() || undefined,
      turns: [],
      thoughtTrail: [],
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      const res = await fetch("/api/socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "start",
          topic: newSession.topic,
          initialStance: newSession.initialStance,
          turns: [],
        }),
      });

      const data = await res.json();
      let responsePayload = data.response;

      if (!res.ok || !responsePayload) {
        responsePayload = makeSocraticDemoTurn({
          kind: "start",
          topic: newSession.topic,
          initialStance: newSession.initialStance,
          turns: [],
          thoughtTrail: [],
        });
      }

      const socTurn: SocraticTurn = {
        id: `soc-turn-${Date.now()}-1`,
        role: "socrates",
        text: responsePayload.dialogue,
        move: responsePayload.move,
        workingQuestion: responsePayload.workingQuestion,
        timestamp: Date.now(),
      };

      const initialThoughtNodes: ThoughtNode[] = [];
      if (newSession.initialStance) {
        initialThoughtNodes.push({
          id: `tn-${Date.now()}-init`,
          sourceTurnIds: [],
          source: "user",
          text: `Quan điểm ban đầu: ${newSession.initialStance}`,
          kind: "initial",
          status: "stated",
        });
      }

      if (responsePayload.thoughtNode) {
        initialThoughtNodes.push({
          ...responsePayload.thoughtNode,
          id: `tn-${Date.now()}-resp`,
        });
      }

      setSession({
        ...newSession,
        turns: [socTurn],
        thoughtTrail: initialThoughtNodes,
        pendingQuestion: responsePayload.workingQuestion,
      });
    } catch (err) {
      console.warn("Error starting socratic session, using fallback", err);
      const fallbackPayload = makeSocraticDemoTurn({
        kind: "start",
        topic: newSession.topic,
        initialStance: newSession.initialStance,
        turns: [],
        thoughtTrail: [],
      });

      const socTurn: SocraticTurn = {
        id: `soc-turn-${Date.now()}-1`,
        role: "socrates",
        text: fallbackPayload.dialogue,
        move: fallbackPayload.move,
        workingQuestion: fallbackPayload.workingQuestion,
        timestamp: Date.now(),
      };

      setSession({
        ...newSession,
        turns: [socTurn],
        pendingQuestion: fallbackPayload.workingQuestion,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const executeSocraticRequest = async (
    kind: SocraticRequestKind,
    userTextInput?: string,
    refinementText?: string,
  ) => {
    if (!session || isBusy) return;

    setIsBusy(true);
    setBusyLabel(
      kind === "ask_clarification"
        ? "Socrates đang giải thích lại câu hỏi…"
        : kind === "ask_example"
          ? "Socrates đang suy nghĩ ví dụ minh họa…"
          : kind === "checkpoint"
            ? "Socrates đang tổng hợp nội dung đối thoại…"
            : kind === "confirm_refinement"
              ? "Socrates đang ghi nhận tinh chỉnh quan điểm…"
              : kind === "finish"
                ? "Đang hoàn tất phiên đối thoại…"
                : "Socrates đang xem xét câu trả lời của bạn…",
    );
    setErrorMsg(null);

    const updatedTurns = [...session.turns];

    // Append user turn if user provided an answer
    if (userTextInput && userTextInput.trim()) {
      const userTurn: SocraticTurn = {
        id: `usr-turn-${Date.now()}`,
        role: "user",
        text: userTextInput.trim(),
        timestamp: Date.now(),
      };
      updatedTurns.push(userTurn);
    }

    try {
      const res = await fetch("/api/socratic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          topic: session.topic,
          initialStance: session.initialStance,
          turns: updatedTurns,
          userInput: userTextInput,
          refinementText,
        }),
      });

      const data = await res.json();
      let responsePayload = data.response;

      if (!res.ok || !responsePayload) {
        responsePayload = makeSocraticDemoTurn({
          kind,
          topic: session.topic,
          initialStance: session.initialStance,
          turns: updatedTurns,
          userInput: userTextInput,
          refinementText,
          thoughtTrail: session.thoughtTrail,
        });
      }

      const socTurn: SocraticTurn = {
        id: `soc-turn-${Date.now()}`,
        role: "socrates",
        text: responsePayload.dialogue,
        move: responsePayload.move,
        workingQuestion: responsePayload.workingQuestion,
        reflectionData: responsePayload.reflectionData,
        refinementSuggestion: responsePayload.refinementSuggestion,
        timestamp: Date.now(),
      };

      const finalTurns = [...updatedTurns, socTurn];
      const newThoughtTrail = [...session.thoughtTrail];

      if (responsePayload.thoughtNode) {
        newThoughtTrail.push({
          ...responsePayload.thoughtNode,
          id: `tn-${Date.now()}`,
        });
      }

      const nextConfirmedStance =
        responsePayload.confirmedStance || session.confirmedStance;
      const nextStatus = responsePayload.nextStatus || (kind === "finish" ? "finished" : session.status);

      setSession({
        ...session,
        turns: finalTurns,
        thoughtTrail: newThoughtTrail,
        confirmedStance: nextConfirmedStance,
        pendingQuestion: responsePayload.workingQuestion || session.pendingQuestion,
        status: nextStatus,
        updatedAt: Date.now(),
      });

      setUserInput("");
      setShowCustomRefinement(false);
      setCustomRefinementInput("");
    } catch (err) {
      console.warn("Socratic API failed, using fallback turn", err);
      const fallbackPayload = makeSocraticDemoTurn({
        kind,
        topic: session.topic,
        initialStance: session.initialStance,
        turns: updatedTurns,
        userInput: userTextInput,
        refinementText,
        thoughtTrail: session.thoughtTrail,
      });

      const socTurn: SocraticTurn = {
        id: `soc-turn-${Date.now()}`,
        role: "socrates",
        text: fallbackPayload.dialogue,
        move: fallbackPayload.move,
        workingQuestion: fallbackPayload.workingQuestion,
        reflectionData: fallbackPayload.reflectionData,
        refinementSuggestion: fallbackPayload.refinementSuggestion,
        timestamp: Date.now(),
      };

      setSession({
        ...session,
        turns: [...updatedTurns, socTurn],
        pendingQuestion: fallbackPayload.workingQuestion || session.pendingQuestion,
        updatedAt: Date.now(),
      });
      setUserInput("");
    } finally {
      setIsBusy(false);
    }
  };

  const handleResetSession = () => {
    if (confirm("Bạn có chắc chắn muốn xóa phiên Socratic hiện tại để bắt đầu lại?")) {
      clearSocraticSession();
      setSession(null);
      setTopicInput("AI có khiến sinh viên ngày càng lười suy nghĩ không?");
      setInitialStanceInput("");
      setUserInput("");
      setShowXRayModal(false);
    }
  };

  // Run Philosophy X-Ray on Socratic transcript
  const handleRunXRay = async () => {
    if (!session || session.turns.length === 0) return;

    setShowXRayModal(true);
    setIsXRayLoading(true);
    setXRayError(null);

    // Map Socratic turns into X-Ray expected format
    const mappedTurns = session.turns.map((turn) => {
      if (turn.role === "socrates") {
        return {
          id: turn.id,
          role: "thinker" as const,
          speakerId: "socrates" as const,
          action: "clarify" as const,
          dialogue: turn.text,
          workingQuestion: turn.workingQuestion,
        };
      }
      return {
        id: turn.id,
        role: "user" as const,
        speakerId: null,
        action: "response" as const,
        dialogue: turn.text,
      };
    });

    try {
      const res = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "xray",
          question: session.topic,
          activeIds: ["socrates", "marx", "lenin"],
          turns: mappedTurns,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setXRayError(data.error || "Không thể thực hiện phân tích X-Ray.");
        setXRayState("no-supported-match");
      } else {
        setXRayState(data.analysisState || "matched");
        setXRayResults(data.result || []);
        setXRayDiagnostics(data.diagnostics || null);
      }
    } catch (err) {
      console.error("X-Ray error", err);
      setXRayError("Đã xảy ra lỗi kết nối khi chạy Philosophy X-Ray.");
      setXRayState("no-supported-match");
    } finally {
      setIsXRayLoading(false);
    }
  };

  return (
    <div className="app-shell pb-16">
      {/* Site Navigation Header */}
      <header className="site-header">
        <div className="brand-group">
          <div className="brand">
            <span className="brand-symbol">S</span>
            <div className="brand-text">
              <span className="brand-title">LĂNG KÍNH · SOCRATIC MODE</span>
              <span className="brand-subtitle">Kiểm tra suy nghĩ & giả định cùng Socrates</span>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="inline-flex rounded-full bg-[var(--paper-deep)] p-1 border border-[var(--line)]">
            {onSwitchToArena && (
              <button
                onClick={onSwitchToArena}
                className="px-4 py-1.5 text-xs font-semibold rounded-full text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
              >
                🏛️ Arena Hội Đồng
              </button>
            )}
            <button className="px-4 py-1.5 text-xs font-semibold rounded-full bg-[var(--green)] !text-white shadow-sm">
              🔍 Socratic Mode
            </button>
          </div>
        </div>

        <div className="header-actions flex justify-end gap-2">
          {session && (
            <>
              <button
                onClick={handleRunXRay}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--paper-deep)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--line)] transition-colors flex items-center gap-1.5"
              >
                <span>🔍</span> Philosophy X-Ray
              </button>
              <button
                onClick={handleResetSession}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-[var(--rust)] hover:bg-red-50 transition-colors"
              >
                Làm mới
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {!session ? (
        /* SETUP SCREEN */
        <main className="max-w-3xl mx-auto my-12 p-8 bg-[var(--paper-deep)] rounded-2xl border border-[var(--line)] shadow-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[var(--gold)] text-white font-serif text-3xl font-bold rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
              S
            </div>
            <h1 className="font-serif text-3xl font-bold text-[var(--ink)] mb-2">
              Khảo sát suy nghĩ cùng Socrates
            </h1>
            <p className="text-sm text-[var(--muted)] max-w-lg mx-auto">
              Socrates không giảng bài, không chấm đúng sai. Ông đưa ra các câu hỏi đối thoại để giúp bạn tự soi chiếu khái niệm, phát hiện giả định ngầm định và tinh chỉnh lập trường.
            </p>
          </div>

          <form onSubmit={handleStartSession} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)] mb-2">
                1. Chủ đề / Vấn đề cần khảo sát <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder="Nhập câu hỏi hoặc chủ đề..."
                className="w-full p-4 text-sm bg-[var(--paper)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-[var(--rust)] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--ink)] mb-2">
                2. Quan điểm ban đầu của bạn <span className="text-[var(--muted)] font-normal">(Tùy chọn)</span>
              </label>
              <textarea
                value={initialStanceInput}
                onChange={(e) => setInitialStanceInput(e.target.value)}
                placeholder="Nếu đã có suy nghĩ ban đầu, hãy viết tại đây. Nếu chưa có, Socrates sẽ bắt đầu bằng việc giúp bạn tìm điểm khởi đầu..."
                rows={3}
                className="w-full p-4 text-sm bg-[var(--paper)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-[var(--rust)] outline-none resize-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isBusy || !topicInput.trim()}
                className="w-full py-4 bg-[var(--green)] hover:bg-[var(--green-deep)] !text-white font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {isBusy ? "Đang kết nối Socrates…" : "Bắt đầu đối thoại Socratic →"}
              </button>
            </div>
          </form>

          {!aiConfigured && (
            <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-3">
              <span className="text-base">💡</span>
              <span>
                <strong>Chế độ xem trước (Demo Mode):</strong> Chưa tìm thấy OPENAI_API_KEY. Phiên Socratic vẫn sẽ hoạt động đầy đủ bằng bộ câu trả lời mẫu thông minh.
              </span>
            </div>
          )}
        </main>
      ) : (
        /* DIALOGUE & THOUGHT TRAIL SCREEN */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-8">
          {/* Main Chat & Interactions (8 Cols) */}
          <main className="lg:col-span-8 flex flex-col gap-6">
            {/* Active Topic Card */}
            <div className="p-5 rounded-2xl bg-[var(--paper-deep)] border border-[var(--line)] flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase">CHỦ ĐỀ ĐANG KHẢO SÁT</span>
                <h2 className="font-serif text-xl font-bold text-[var(--ink)] mt-0.5">{session.topic}</h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[var(--green)] text-white">
                {session.status === "finished" ? "Đã hoàn thành" : "Đang đối thoại"}
              </span>
            </div>

            {/* Pending Working Question Bar */}
            {session.pendingQuestion && session.status !== "finished" && (
              <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200/80 shadow-sm flex items-start gap-3">
                <span className="text-xl leading-none">❓</span>
                <div className="flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 block mb-0.5">
                    CÂU HỎI ĐANG CHỜ PHẢN HỒI TỪ BẠN
                  </span>
                  <p className="text-sm font-semibold text-amber-950">{session.pendingQuestion}</p>
                </div>
              </div>
            )}

            {/* Timeline Transcript */}
            <div className="space-y-6">
              {session.turns.map((turn) => (
                <div
                  key={turn.id}
                  className={`p-6 rounded-2xl border transition-all ${turn.role === "socrates"
                    ? "bg-[var(--paper-deep)] border-[var(--line)] text-[var(--ink)]"
                    : "bg-[var(--green-deep)] border-[var(--green)] text-white ml-6"
                    }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${turn.role === "socrates" ? "bg-[var(--gold)] text-white" : "bg-[var(--gold)] text-white"
                          }`}
                      >
                        {turn.role === "socrates" ? "S" : "Bạn"}
                      </div>
                      <span className="font-serif font-bold text-sm">
                        {turn.role === "socrates" ? "Socrates" : "Bạn"}
                      </span>
                    </div>

                    {turn.move && (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider bg-[var(--gold)]/20 text-[var(--ink)] border border-[var(--gold)]/40 uppercase">
                        {MOVE_LABELS[turn.move] || turn.move}
                      </span>
                    )}
                  </div>

                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.text}</p>

                  {/* Reflection Card if present */}
                  {turn.reflectionData && (
                    <div className="mt-4 p-4 rounded-xl bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)] space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--rust)] flex items-center gap-1.5">
                        <span>∴</span> TÓM LƯỢC TRUNG TÍNH ĐỐI THOẠI
                      </div>
                      <p className="text-xs italic text-[var(--muted)]">{turn.reflectionData.summary}</p>

                      {turn.reflectionData.confirmedPoints.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold text-emerald-800 block mb-1">
                            ✓ Điểm bạn đã khẳng định/làm rõ:
                          </span>
                          <ul className="list-disc list-inside text-xs space-y-1 text-[var(--ink)] pl-1">
                            {turn.reflectionData.confirmedPoints.map((pt, idx) => (
                              <li key={idx}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {turn.reflectionData.openAssumptions.length > 0 && (
                        <div>
                          <span className="text-[11px] font-semibold text-amber-800 block mb-1">
                            ? Giả định / Điểm còn mở:
                          </span>
                          <ul className="list-disc list-inside text-xs space-y-1 text-[var(--muted)] pl-1">
                            {turn.reflectionData.openAssumptions.map((pt, idx) => (
                              <li key={idx}>{pt}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Refinement Suggestion Card */}
                  {turn.refinementSuggestion && session.status !== "finished" && (
                    <div className="mt-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        <span>✨</span> GỢI Ý TINH CHỈNH LẬP TRƯỜNG
                      </div>
                      <p className="text-sm font-serif italic text-amber-900">
                        "{turn.refinementSuggestion}"
                      </p>

                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() =>
                            executeSocraticRequest("confirm_refinement", undefined, turn.refinementSuggestion!)
                          }
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-800 !text-white hover:bg-amber-900 transition-colors shadow-sm"
                        >
                          ✓ Đồng ý dùng cách diễn đạt này
                        </button>
                        <button
                          onClick={() => setShowCustomRefinement(!showCustomRefinement)}
                          disabled={isBusy}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors"
                        >
                          ✏️ Tự viết lại theo ý tôi
                        </button>
                      </div>

                      {showCustomRefinement && (
                        <div className="pt-2 space-y-2">
                          <textarea
                            value={customRefinementInput}
                            onChange={(e) => setCustomRefinementInput(e.target.value)}
                            placeholder="Nhập lập trường đã được tinh chỉnh của bạn..."
                            rows={2}
                            className="w-full p-3 text-xs bg-white border border-amber-300 rounded-lg outline-none"
                          />
                          <button
                            onClick={() =>
                              executeSocraticRequest("confirm_refinement", undefined, customRefinementInput)
                            }
                            disabled={isBusy || !customRefinementInput.trim()}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--green)] !text-white hover:bg-[var(--green-deep)] transition-colors"
                          >
                            Xác nhận quan điểm tự chỉnh
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* User Input & Action Panel */}
            {session.status !== "finished" ? (
              <div className="p-6 rounded-2xl bg-[var(--paper-deep)] border border-[var(--line)] space-y-4">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Nhập câu trả lời hoặc phản hồi của bạn dành cho Socrates..."
                  rows={3}
                  className="w-full p-4 text-sm bg-[var(--paper)] border border-[var(--line)] rounded-xl focus:ring-2 focus:ring-[var(--rust)] outline-none resize-none"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => executeSocraticRequest("ask_clarification")}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--paper-deep)] transition-colors"
                    >
                      ❓ Xin làm rõ câu hỏi
                    </button>
                    <button
                      onClick={() => executeSocraticRequest("ask_example")}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--paper-deep)] transition-colors"
                    >
                      💡 Cho xin ví dụ minh họa
                    </button>
                    <button
                      onClick={() => executeSocraticRequest("checkpoint")}
                      disabled={isBusy}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--paper-deep)] transition-colors"
                    >
                      ∴ Checkpoint tóm lược
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => executeSocraticRequest("finish")}
                      disabled={isBusy}
                      className="px-3 py-2 text-xs font-bold rounded-xl text-[var(--rust)] hover:bg-red-50 transition-colors"
                    >
                      Kết thúc phiên
                    </button>
                    <button
                      onClick={() => executeSocraticRequest("answer", userInput)}
                      disabled={isBusy || !userInput.trim()}
                      className="px-5 py-2 text-xs font-bold rounded-xl bg-[var(--green)] hover:bg-[var(--green-deep)] !text-white shadow-md transition-all disabled:opacity-50"
                    >
                      {isBusy ? busyLabel : "Gửi câu trả lời →"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* FINISHED SESSION SUMMARY CARD */
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg font-bold text-emerald-900">
                    🎉 Phiên đối thoại Socratic đã hoàn tất
                  </h3>
                  <button
                    onClick={handleRunXRay}
                    className="px-4 py-2 text-xs font-bold rounded-xl bg-[var(--green)] !text-white shadow-sm hover:bg-[var(--green-deep)]"
                  >
                    🔍 Đối chiếu Philosophy X-Ray →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-xl bg-white border border-emerald-100">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] block mb-1">
                      QUAN ĐIỂM BAN ĐẦU
                    </span>
                    <p className="text-xs text-[var(--ink)] italic">
                      "{session.initialStance || "Chưa cung cấp quan điểm ban đầu"}"
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-emerald-200">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                      QUAN ĐIỂM ĐÃ TINH CHỈNH & XÁC NHẬN
                    </span>
                    <p className="text-xs text-emerald-950 font-semibold">
                      "{session.confirmedStance || "Chưa tinh chỉnh quan điểm chính thức"}"
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>

          {/* Thought Trail Sidebar (4 Cols) */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="p-6 rounded-2xl bg-[var(--paper-deep)] border border-[var(--line)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-base font-bold text-[var(--ink)] flex items-center gap-2">
                  <span>🧠</span> Thought Trail
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--paper)] text-[var(--muted)]">
                  {session.thoughtTrail.length} nút
                </span>
              </div>

              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {session.thoughtTrail.length === 0 ? (
                  <p className="text-xs text-[var(--muted)] italic text-center py-6">
                    Chưa có nút tư duy nào được ghi nhận. Hãy tiếp tục đối thoại để xem Thought Trail.
                  </p>
                ) : (
                  session.thoughtTrail.map((node) => (
                    <div
                      key={node.id}
                      className="p-3.5 rounded-xl bg-[var(--paper)] border border-[var(--line)] text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span
                          className={`font-bold px-1.5 py-0.5 rounded ${node.source === "user"
                            ? "bg-[var(--green)]/10 text-[var(--green)]"
                            : "bg-[var(--gold)]/20 text-[var(--ink)]"
                            }`}
                        >
                          {node.source === "user" ? "Người dùng" : "Socrates (Gợi ý)"}
                        </span>
                        <span className="text-[var(--muted)] uppercase font-semibold">{node.kind}</span>
                      </div>
                      <p className="text-[var(--ink)] leading-snug">{node.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Philosophy X-Ray Modal */}
      {showXRayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[var(--paper)] max-w-4xl w-full rounded-2xl p-6 border border-[var(--line)] shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4 mb-6">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-[var(--muted)] uppercase">
                  PHILOSOPHY X-RAY · SOCRATIC TRANSCRIPT
                </span>
                <h3 className="font-serif text-xl font-bold text-[var(--ink)]">
                  Đối chiếu Học thuật Giáo trình MLN111
                </h3>
              </div>
              <button
                onClick={() => setShowXRayModal(false)}
                className="w-8 h-8 rounded-full bg-[var(--paper-deep)] hover:bg-[var(--line)] text-[var(--ink)] font-bold flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            {isXRayLoading ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-10 h-10 border-4 border-[var(--green)] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-semibold text-[var(--ink)]">
                  Đang truy hồi và đối chiếu lập luận đối thoại với Giáo trình MLN111…
                </p>
              </div>
            ) : xrayError ? (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
                {xrayError}
              </div>
            ) : xrayResults.length === 0 ? (
              <div className="py-8 text-center text-[var(--muted)] text-sm">
                Chưa tìm thấy đoạn tương thích đủ căn cứ trong giáo trình MLN111.
              </div>
            ) : (
              <div className="space-y-4">
                {xrayResults.map((result, idx) => {
                  const concept = result.conceptId ? MLN_CONCEPTS_BY_ID[result.conceptId] : null;
                  const cardKey = result.sourceChunkId || `xray-card-${idx}`;
                  const isExpanded = expandedXRayCardId === cardKey;

                  return (
                    <div
                      key={cardKey}
                      className="p-5 rounded-xl bg-[var(--paper-deep)] border border-[var(--line)] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-serif font-bold text-sm text-[var(--ink)]">
                          {concept ? concept.title : result.sourceTitle}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[var(--green)] text-white">
                          {result.supportType === "direct" ? "Trích dẫn trực tiếp" : "Diễn giải học thuật"}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--ink)]">{result.whyItMatches}</p>

                      {result.everydayExample && (
                        <div className="p-3 rounded-lg bg-[var(--paper)] text-xs text-[var(--muted)] border border-[var(--line)]">
                          <strong>Ví dụ minh họa:</strong> {result.everydayExample}
                        </div>
                      )}

                      <div className="flex justify-between items-center text-[10px] text-[var(--muted)] pt-2 border-t border-[var(--line)]">
                        <span>Trích từ: {result.sourceTitle}</span>
                        <button
                          onClick={() => setExpandedXRayCardId(isExpanded ? null : cardKey)}
                          className="font-bold text-[var(--rust)] hover:underline"
                        >
                          {isExpanded ? "Thu gọn ▲" : "Xem trích dẫn đầy đủ ▼"}
                        </button>
                      </div>

                      {isExpanded && result.sourceCitations && (
                        <div className="mt-3 p-4 rounded-lg bg-[var(--paper)] border border-[var(--line)] space-y-2 text-xs">
                          {result.sourceCitations.map((cit, citIdx) => (
                            <div key={citIdx} className="space-y-1">
                              <p className="font-serif italic text-[var(--ink)]">
                                "{cit.quotes[0] || cit.excerpt}"
                              </p>
                              <div className="text-[10px] text-[var(--muted)]">
                                Trang {cit.printedPageStart || "N/A"} · Dòng {cit.lineStart}-{cit.lineEnd}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
