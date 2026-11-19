import { toPersianDigits } from "@/lib/persian";
import type { Explanation } from "@/lib/types";

export default function WhyBest({ explanation }: { explanation: Explanation }) {
  if (!explanation.bullets.length) return null;
  return (
    <div className="rounded-xl border border-brand/15 bg-gradient-to-l from-brand-soft to-white p-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-black text-brand">چرا رتبهٔ اول؟</span>
        <span className="text-[10px] text-muted">{explanation.by === "llm" ? "بازنویسی با هوش مصنوعی از اعداد واقعی" : "محاسبه‌شده از اعداد واقعی"}</span>
      </div>
      <ul className="space-y-1.5 text-[13px] leading-6">
        {explanation.bullets.map((b) => (
          <li key={b.vs} className="flex gap-2">
            <span className="num mt-0.5 shrink-0 rounded border border-line bg-white px-1.5 text-[11px] font-bold text-muted">در برابر #{toPersianDigits(b.vs)}</span>
            <span className="num">{b.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
