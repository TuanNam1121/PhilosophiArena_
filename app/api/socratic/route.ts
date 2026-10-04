import { NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  SocraticServerRequestSchema,
  SocraticServerResponseSchema,
  SOCRATES_SYSTEM_PROMPT,
} from "@/lib/socratic-prompts";
import { makeSocraticDemoTurn, type SocraticResponse } from "@/lib/socratic";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsedReq = SocraticServerRequestSchema.safeParse(json);

    if (!parsedReq.success) {
      return NextResponse.json(
        { error: "Dữ liệu yêu cầu không hợp lệ.", details: parsedReq.error.format() },
        { status: 400 },
      );
    }

    const body = parsedReq.data;
    const apiKey = process.env.OPENAI_API_KEY;

    // Fallback to mock answers if OPENAI_API_KEY is missing
    if (!apiKey) {
      const demoResponse = makeSocraticDemoTurn({
        kind: body.kind,
        topic: body.topic,
        initialStance: body.initialStance,
        turns: body.turns as any,
        userInput: body.userInput,
        refinementText: body.refinementText,
        thoughtTrail: [],
      });
      return NextResponse.json({
        type: "socratic",
        aiConfigured: false,
        response: demoResponse,
      });
    }

    const aiModel = process.env.AI_MODEL || "gpt-4o";
    const openai = new OpenAI({ apiKey });

    try {
      const response = await openai.responses.parse({
        model: aiModel,
        instructions: SOCRATES_SYSTEM_PROMPT,
        input: JSON.stringify({
          kind: body.kind,
          topic: body.topic,
          initialStance: body.initialStance,
          userInput: body.userInput,
          refinementText: body.refinementText,
          recentTurns: body.turns.slice(-10),
        }),
        store: false,
        text: { format: zodTextFormat(SocraticServerResponseSchema, "socratic_response") },
      });

      if (response.status === "completed" && response.output_parsed) {
        const parsedData = response.output_parsed;
        const formattedResponse: SocraticResponse = {
          move: parsedData.move,
          dialogue: parsedData.dialogue,
          workingQuestion: parsedData.workingQuestion,
          thoughtNode: parsedData.thoughtNodeText
            ? {
                sourceTurnIds: body.turns.slice(-2).map((t) => t.id),
                source: parsedData.thoughtNodeSource || "socrates",
                text: parsedData.thoughtNodeText,
                kind: parsedData.thoughtNodeKind || "clarification",
                status: parsedData.thoughtNodeStatus || "stated",
              }
            : null,
          reflectionData: parsedData.reflectionSummary
            ? {
                summary: parsedData.reflectionSummary,
                confirmedPoints: parsedData.reflectionConfirmedPoints || [],
                openAssumptions: parsedData.reflectionOpenAssumptions || [],
              }
            : null,
          refinementSuggestion: parsedData.refinementSuggestion || null,
          confirmedStance: parsedData.confirmedStance || null,
        };

        return NextResponse.json({
          type: "socratic",
          aiConfigured: true,
          response: formattedResponse,
        });
      }
    } catch (aiError) {
      console.warn("AI parse failed, falling back to mock generator:", aiError);
    }

    // Fallback if AI response failed or returned incomplete output
    const demoResponse = makeSocraticDemoTurn({
      kind: body.kind,
      topic: body.topic,
      initialStance: body.initialStance,
      turns: body.turns as any,
      userInput: body.userInput,
      refinementText: body.refinementText,
      thoughtTrail: [],
    });

    return NextResponse.json({
      type: "socratic",
      aiConfigured: true,
      fallbackUsed: true,
      response: demoResponse,
    });
  } catch (error) {
    console.error("Socratic API Error:", error);
    return NextResponse.json(
      { error: "Đã xảy ra lỗi máy chủ trong phiên Socratic." },
      { status: 500 },
    );
  }
}
