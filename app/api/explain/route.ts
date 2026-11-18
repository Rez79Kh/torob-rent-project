import { NextResponse } from "next/server";
import { z } from "zod";
import { chatJSON, llmConfig } from "@/lib/llm/client";
import type { Explanation } from "@/lib/types";

const Body = z.object({ bullets: z.array(z.object({ vs: z.number(), text: z.string().max(400) })).max(3) });
const Out = z.object({ bullets: z.array(z.object({ vs: z.number(), text: z.string() })) });

const SYSTEM = `You rewrite comparison facts about Tehran apartments into short, natural Persian sentences for a renter.
Each input bullet explains why listing #1 beats listing #vs. Keep EVERY number exactly as given, add no new facts, max 25 words per bullet.
Return JSON: {"bullets":[{"vs":number,"text":string}]}`;

/** Rephrases already-computed facts; numbers must survive the rewrite or the template is returned. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const template: Explanation = { bullets: parsed.data.bullets, by: "template" };
  if (!llmConfig() || !parsed.data.bullets.length) return NextResponse.json(template);

  try {
    const { data } = await chatJSON([
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(parsed.data.bullets) },
    ]);
    const out = Out.safeParse(data);
    if (!out.success) return NextResponse.json(template);
    const digits = (s: string) => (s.match(/[۰-۹\d]+/g) ?? []).join(",");
    const faithful = out.data.bullets.every((b) => {
      const src = parsed.data.bullets.find((x) => x.vs === b.vs);
      return src && digits(src.text) === digits(b.text);
    });
    return NextResponse.json(faithful ? ({ bullets: out.data.bullets, by: "llm" } satisfies Explanation) : template);
  } catch {
    return NextResponse.json(template);
  }
}
