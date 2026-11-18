import SearchShell from "@/components/SearchShell";
import { clientData } from "@/lib/data";
import { llmConfig } from "@/lib/llm/client";

export default function Home() {
  return <SearchShell data={clientData()} llmEnabled={!!llmConfig()} />;
}
