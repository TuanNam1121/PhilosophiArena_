"use client";

import { useState } from "react";
import { ArenaWorkbench } from "@/components/arena-workbench";
import { SocraticWorkbench } from "@/components/socratic-workbench";

interface MainWorkbenchProps {
  aiConfigured: boolean;
}

export function MainWorkbench({ aiConfigured }: MainWorkbenchProps) {
  const [mode, setMode] = useState<"arena" | "socratic">("arena");

  if (mode === "socratic") {
    return (
      <SocraticWorkbench
        aiConfigured={aiConfigured}
        onSwitchToArena={() => setMode("arena")}
      />
    );
  }

  return (
    <ArenaWorkbench
      aiConfigured={aiConfigured}
      onSwitchToSocratic={() => setMode("socratic")}
    />
  );
}
