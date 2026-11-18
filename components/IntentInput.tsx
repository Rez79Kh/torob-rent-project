"use client";

import { useState } from "react";
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
          onQuery(q);
        }}
        className="flex items-stretch gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-line focus-within:ring-2 focus-within:ring-brand"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="به زبان خودتان بنویسید: «۲ میلیارد نقد دارم، ماهی تا ۴۰ تومن، نزدیک مترو، پارکینگ لازمه»"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-gray-400"
          aria-label="جستجوی هوشمند"
        />
        <button type="submit" className="shrink-0 rounded-xl bg-brand px-5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60" disabled={parsing}>
          {parsing ? "در حال فهمیدن…" : "بگرد"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => {
              setQ(ex);
              onQuery(ex);
            }}
            className="rounded-full bg-white px-3 py-1 text-xs text-muted ring-1 ring-line hover:text-brand hover:ring-brand"
          >
            {ex}
          </button>
        ))}
      </div>

      {intent.rawQuery && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted">برداشت ما از جملهٔ شما{intent.parsedBy === "llm" ? " (هوش مصنوعی)" : intent.parsedBy === "rules" ? " (پردازشگر فارسی)" : ""}:</span>
          <Chip>پول نقد {fmtToman(intent.cash, { unit: false })}</Chip>
          <Chip>اجاره تا {fmtToman(intent.maxRent, { unit: false })}</Chip>
          {intent.minArea && <Chip>حداقل {toPersianDigits(intent.minArea)} متر</Chip>}
          {intent.minRooms && <Chip>{toPersianDigits(intent.minRooms)} خواب+</Chip>}
          {intent.maxBuildAge && <Chip>زیر {toPersianDigits(intent.maxBuildAge)} سال ساخت</Chip>}
          {intent.household && <Chip>{HOUSEHOLD_FA[intent.household]}</Chip>}
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
              className={`rounded-full px-3 py-1 ring-1 ${on ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-line hover:ring-ink"}`}
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
              className={`rounded-full px-3 py-1 ring-1 ${
                must ? "bg-brand text-white ring-brand" : nice ? "bg-brand-soft text-brand ring-brand/40" : "bg-white text-ink ring-line hover:ring-ink"
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
            className={`rounded-full px-3 py-1 ring-1 ${intent.household === h ? "bg-ink text-white ring-ink" : "bg-white ring-line hover:ring-ink"}`}
          >
            {HOUSEHOLD_FA[h]}
          </button>
        ))}
      </div>
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="num rounded-full bg-brand-soft px-2.5 py-1 font-medium text-brand">{children}</span>;
}
