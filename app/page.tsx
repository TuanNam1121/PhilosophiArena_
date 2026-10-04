import { MainWorkbench } from "@/components/main-workbench";

export default function Home() {
  return (
    <MainWorkbench aiConfigured={Boolean(process.env.OPENAI_API_KEY)} />
  );
}
