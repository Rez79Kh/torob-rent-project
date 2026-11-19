"use client";

import { useEffect, useState } from "react";
import { NEIGHBORHOODS } from "@/lib/geo";
import { fmtToman } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
import type { Household, MustKey, UserIntent } from "@/lib/types";

const EXAMPLES = [
  "۲ میلیارد نقد دارم، ماهی تا ۴۰ تومن، نزدیک مترو، پارکینگ لازمه",
  "مجردم، ۱ میلیارد پول دارم ماهی ۳۰ میلیون، پونک یا صادقیه",
  "زوج جوان، ۴ میلیارد رهن، حداقل ۹۰ متر دو خواب، آسانسور و پارکینگ حتما",
  "3 milyard naghd, mahi 20 toman, tehranpars, parking",
];

const MUST_FA: Record<MustKey, string> = {
  parking: "پارکینگ",
  elevator: "آسانسور",
  storage: "انباری",
  balcony: "بالکن",
  renovated: "بازسازی‌شده",
  near_metro: "نزدیک مترو",
};

const HOUSEHOLD_FA: Record<Household, string> = { single: "مجرد", couple: "زوج", family: "خانواده" };

export default function IntentInput({
  intent,
  parsing,
  llmEnabled,
  onQuery,
  onChange,
}: {
  intent: UserIntent;
  parsing: boolean;
  llmEnabled: boolean;
  onQuery: (q: string) => void;
  onChange: (i: UserIntent) => void;
}) {
  const [q, setQ] = useState("");
  const [req, setReq] = useState<{ id: number; at: number } | null>(null);
  const [pulse, setPulse] = useState(false);
  const loading = req !== null || parsing;

  useEffect(() => {
    if (!req || parsing) return;
    const wait = Math.max(0, 350 - (performance.now() - req.at));
    const show = window.setTimeout(() => {
      setReq(null);
      setPulse(true);
    }, wait);
    return () => window.clearTimeout(show);
  }, [req, parsing]);

  useEffect(() => {
    if (!pulse) return;
    const hide = window.setTimeout(() => setPulse(false), 650);
    return () => window.clearTimeout(hide);
  }, [pulse]);

  const ask = (text: string) => {
    setPulse(false);
    setReq({ id: Date.now(), at: performance.now() });
    onQuery(text);
  };

  const toggleHood = (slug: string) =>
    onChange({
      ...intent,
      neighborhoods: intent.neighborhoods.includes(slug) ? intent.neighborhoods.filter((s) => s !== slug) : [...intent.neighborhoods, slug],
    });

  const cycleMust = (k: MustKey) => {
    if (intent.must.includes(k)) onChange({ ...intent, must: intent.must.filter((m) => m !== k), nice: [...intent.nice, k] });
    else if (intent.nice.includes(k)) onChange({ ...intent, nice: intent.nice.filter((m) => m !== k) });
    else onChange({ ...intent, must: [...intent.must, k] });
  };

  return (
    <section className="mt-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) ask(q);
        }}
        className="flex items-stretch gap-2 rounded-2xl border border-line bg-white p-2 focus-within:border-brand focus-within:shadow-[0_0_0_1px_var(--color-brand)]"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="به زبان خودتان بنویسید: «۲ میلیارد نقد دارم، ماهی تا ۴۰ تومن، نزدیک مترو، پارکینگ لازمه»"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-gray-400"
          aria-label="جستجوی هوشمند"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-5 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden />
              در حال تحلیل...
            </>
          ) : (
            "بگرد"
          )}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQ(ex);
              ask(ex);
            }}
            className="rounded-full border border-line bg-white px-3 py-1 text-xs text-muted hover:border-brand hover:text-brand"
          >
            {ex}
          </button>
        ))}
      </div>

      {intent.rawQuery && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">برداشت ما از جملهٔ شما{intent.parsedBy === "llm" ? " (هوش مصنوعی)" : intent.parsedBy === "rules" ? " (پردازشگر فارسی)" : ""}:</span>
          <Chip pulse={pulse}>پول نقد {fmtToman(intent.cash, { unit: false })}</Chip>
          <Chip pulse={pulse}>اجاره تا {fmtToman(intent.maxRent, { unit: false })}</Chip>
          {intent.minArea && <Chip pulse={pulse}>حداقل {toPersianDigits(intent.minArea)} متر</Chip>}
          {intent.minRooms && <Chip pulse={pulse}>{toPersianDigits(intent.minRooms)} خواب+</Chip>}
          {intent.maxBuildAge && <Chip pulse={pulse}>زیر {toPersianDigits(intent.maxBuildAge)} سال ساخت</Chip>}
          {intent.household && <Chip pulse={pulse}>{HOUSEHOLD_FA[intent.household]}</Chip>}
          {!llmEnabled && <span className="text-[11px] text-gray-400">بدون کلید API هم کار می‌کند</span>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="me-1 text-muted">محله:</span>
        {NEIGHBORHOODS.map((n) => {
          const on = intent.neighborhoods.includes(n.slug);
          return (
            <button
              key={n.slug}
              onClick={() => toggleHood(n.slug)}
              className={`rounded-full border px-3 py-1 ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"}`}
            >
              {n.fa}
            </button>
          );
        })}
        <span className="mx-2 h-4 w-px bg-line" />
        <span className="me-1 text-muted">امکانات:</span>
        {(Object.keys(MUST_FA) as MustKey[]).map((k) => {
          const must = intent.must.includes(k);
          const nice = intent.nice.includes(k);
          return (
            <button
              key={k}
              onClick={() => cycleMust(k)}
              title="یک کلیک: ضروری | دو کلیک: ترجیحی | سه کلیک: مهم نیست"
              className={`rounded-full border px-3 py-1 ${
                must ? "border-brand bg-brand text-white" : nice ? "border-brand/40 bg-brand-soft text-brand" : "border-line bg-white text-ink hover:border-ink"
              }`}
            >
              {MUST_FA[k]}
              {must ? " | ضروری" : nice ? " | ترجیحی" : ""}
            </button>
          );
        })}
        <span className="mx-2 h-4 w-px bg-line" />
        {(["single", "couple", "family"] as Household[]).map((h) => (
          <button
            key={h}
            onClick={() => onChange({ ...intent, household: intent.household === h ? undefined : h })}
            className={`rounded-full border px-3 py-1 ${intent.household === h ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
          >
            {HOUSEHOLD_FA[h]}
          </button>
        ))}
      </div>
    </section>
  );
}

function Chip({ children, pulse }: { children: React.ReactNode; pulse?: boolean }) {
  return <span className={`num rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand ${pulse ? "chip-pulse" : ""}`}>{children}</span>;
}
