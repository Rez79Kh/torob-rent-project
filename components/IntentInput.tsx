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
  const [more, setMore] = useState(false);
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
    <section>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading) ask(q);
        }}
        className="flex items-stretch gap-2 rounded-2xl border border-line bg-white p-1.5 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.45)] focus-within:border-brand"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="به زبان خودتان بنویسید: «۲ میلیارد نقد دارم، ماهی تا ۴۰ تومن، نزدیک مترو، پارکینگ لازمه»"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
          aria-label="جستجوی هوشمند"
        />
        <button
          type="submit"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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

      <div className="hide-scroll mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
        {intent.rawQuery && (
          <>
            <Chip pulse={pulse}>پول نقد {fmtToman(intent.cash, { unit: false })}</Chip>
            <Chip pulse={pulse}>اجاره تا {fmtToman(intent.maxRent, { unit: false })}</Chip>
            {intent.minArea && <Chip pulse={pulse}>حداقل {toPersianDigits(intent.minArea)} متر</Chip>}
            {intent.minRooms && <Chip pulse={pulse}>{toPersianDigits(intent.minRooms)} خواب+</Chip>}
            {intent.maxBuildAge && <Chip pulse={pulse}>زیر {toPersianDigits(intent.maxBuildAge)} سال ساخت</Chip>}
            {intent.household && <Chip pulse={pulse}>{HOUSEHOLD_FA[intent.household]}</Chip>}
          </>
        )}
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQ(ex);
              ask(ex);
            }}
            className="max-w-[14rem] shrink-0 truncate rounded-full border border-line bg-white px-3 py-1 text-[11px] text-muted hover:border-brand hover:text-brand"
          >
            {ex}
          </button>
        ))}
        {NEIGHBORHOODS.map((n) => {
          const on = intent.neighborhoods.includes(n.slug);
          return (
            <button
              key={n.slug}
              type="button"
              onClick={() => toggleHood(n.slug)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-slate-400"}`}
            >
              {n.fa}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMore((open) => !open)}
          className="shrink-0 rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-500 hover:border-brand hover:text-brand"
          aria-expanded={more}
        >
          {more ? "بستن فیلترها" : "+ فیلترهای بیشتر"}
        </button>
      </div>

      {more && (
        <div className="mt-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(Object.keys(MUST_FA) as MustKey[]).map((k) => {
              const must = intent.must.includes(k);
              const nice = intent.nice.includes(k);
              return (
                <button
                  key={k}
                  type="button"
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
            {(["single", "couple", "family"] as Household[]).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => onChange({ ...intent, household: intent.household === h ? undefined : h })}
                className={`rounded-full border px-3 py-1 ${intent.household === h ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
              >
                {HOUSEHOLD_FA[h]}
              </button>
            ))}
            {!llmEnabled && <span className="text-[11px] text-slate-400">بدون کلید API هم کار می‌کند</span>}
          </div>
        </div>
      )}
    </section>
  );
}

function Chip({ children, pulse }: { children: React.ReactNode; pulse?: boolean }) {
  return <span className={`num shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand ${pulse ? "chip-pulse" : ""}`}>{children}</span>;
}
