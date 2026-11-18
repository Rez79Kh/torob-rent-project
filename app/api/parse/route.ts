import { NextResponse } from "next/server";
import { z } from "zod";
import { parseIntentLlm } from "@/lib/intent/llm";
import { DEFAULT_INTENT, parseIntentRules } from "@/lib/intent/rules";
import { llmConfig } from "@/lib/llm/client";
import type { UserIntent } from "@/lib/types";

const Body = z.object({ q: z.string().max(500), base: z.record(z.unknown()).optional() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const base = { ...DEFAULT_INTENT, ...(parsed.data.base as Partial<UserIntent> | undefined) };
  const q = parsed.data.q;

  if (llmConfig()) {
    try {
      return NextResponse.json(await parseIntentLlm(q, base));
    } catch {
      /* fall through to rules */
    }
  }
  return NextResponse.json(parseIntentRules(q, base));
}
