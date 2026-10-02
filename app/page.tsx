import { ArenaWorkbench } from "@/components/arena-workbench";

export default function Home() {
  return (
    <ArenaWorkbench aiConfigured={Boolean(process.env.OPENAI_API_KEY)} />
  );
}
