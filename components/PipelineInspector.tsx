"use client";

import { useEffect, useMemo, useState } from "react";
import { marketMonthly } from "@/lib/convert";
import type { ClientData } from "@/lib/data";
import { NEIGHBORHOOD_BY_SLUG } from "@/lib/geo";
import { fmtToman } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
import type { NormalizedListing, RankedResult, RawListing, UserIntent, Weights } from "@/lib/types";
import { SOURCE_FA } from "./PropertyCard";
import { FLAG_FA } from "./RedFlags";

type Tab = "raw" | "normalized" | "cluster" | "score";

const TABS: { id: Tab; label: string }[] = [
  { id: "raw", label: "آگهی خام" },
  { id: "normalized", label: "استخراج‌شده" },
  { id: "cluster", label: "ادغام تکراری‌ها" },
  { id: "score", label: "امتیاز رتبه‌بندی" },
];

const WEIGHT_FA: Record<keyof Weights, string> = {
  cost: "هزینه با پول شما",
  fairness: "قیمت منصفانهٔ محله",
  fit: "تطابق با خواسته‌ها",
  trust: "اعتماد به آگهی",
  commute: "دسترسی به مترو",
};

const SCORE_TONE: Record<keyof Weights, string> = {
  cost: "bg-[#f31d3a]",
  fairness: "bg-emerald-500",
  fit: "bg-sky-500",
  trust: "bg-amber-500",
  commute: "bg-indigo-500",
};

function Meter({ label, value, mark, tone }: { label: string; value: number; mark?: number; tone: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className="mt-1">
      <div className="num mb-0.5 flex justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span>{toPersianDigits(Math.round(pct))}٪</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-slate-100">
        <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
        {mark != null && <span className="absolute top-[-2px] h-2.5 w-px bg-slate-700" style={{ left: `${mark * 100}%` }} title="آستانهٔ ۰٫۶۸" />}
      </div>
    </div>
  );
}

export default function PipelineInspector({
  result,
  data,
  intent,
  onClose,
}: {
  result: RankedResult;
  data: ClientData;
  intent: UserIntent;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("raw");
  const [memberId, setMemberId] = useState(result.listing.id);
  const [raw, setRaw] = useState<RawListing | null>(null);
  const byId = useMemo(() => new Map(data.listings.map((l) => [l.id, l])), [data.listings]);
  const listing = byId.get(memberId) ?? result.listing;

  useEffect(() => {
    let cancelled = false;
    setRaw(null);
    fetch(`/api/raw/${encodeURIComponent(listing.rawId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setRaw(j));
    return () => {
      cancelled = true;
    };
  }, [listing.rawId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2000] flex" role="dialog" aria-modal="true" aria-label="آنالیز هوشمند آگهی">
      <div className="flex-1 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="flex h-full w-full max-w-[680px] flex-col rounded-s-3xl bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.45)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <div className="text-xs font-bold text-brand">آنالیز هوشمند آگهی</div>
            <div className="num text-sm font-black">
              {toPersianDigits(listing.areaM2)} متر | {NEIGHBORHOOD_BY_SLUG[listing.neighborhood]?.fa} | {toPersianDigits(result.cluster.memberIds.length)} آگهی
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-gray-50">
            بستن
          </button>
        </div>

        {result.cluster.memberIds.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-b border-line px-5 py-2">
            {result.cluster.memberIds.map((id) => {
              const m = byId.get(id)!;
              return (
                <button
                  key={id}
                  onClick={() => setMemberId(id)}
                  className={`num shrink-0 rounded-lg px-2.5 py-1 text-xs ring-1 ${
                    id === memberId ? "bg-ink text-white ring-ink" : "ring-line hover:ring-ink"
                  }`}
                >
                  {SOURCE_FA[m.source]} | {m.advertiser.kind === "owner" ? "مالک" : m.advertiser.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-1 border-b border-line px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`-mb-px border-b-2 px-3 py-2.5 text-sm ${tab === t.id ? "border-brand font-bold text-brand" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4 text-sm">
          {tab === "raw" && <RawTab raw={raw} />}
          {tab === "normalized" && <NormalizedTab l={listing} />}
          {tab === "cluster" && <ClusterTab result={result} byId={byId} rate={data.conversionRate} onPick={(id) => { setMemberId(id); setTab("raw"); }} />}
          {tab === "score" && <ScoreTab result={result} intent={intent} />}
        </div>
      </aside>
    </div>
  );
}

function RawTab({ raw }: { raw: RawListing | null }) {
  if (!raw) return <div className="h-40 animate-pulse rounded-xl bg-gray-100" />;
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        همان چیزی که از {SOURCE_FA[raw.source]} گرفتیم، بدون هیچ تغییری.
        {raw.isSeed ? " (دادهٔ نمونه با ساختار واقعی آگهی‌ها)" : " (آگهی واقعی)"}
      </p>
      <Field k="عنوان" v={raw.title} />
      <Field k="ودیعه (متن خام)" v={raw.priceText.deposit ?? "—"} />
      <Field k="اجاره (متن خام)" v={raw.priceText.rent ?? "—"} />
      {raw.convertibleFlag && <Field k="تیک «قابل تبدیل» در فرم" v="بله" />}
      {raw.badges.length > 0 && <Field k="برچسب‌ها" v={raw.badges.join("، ")} />}
      <div>
        <div className="mb-1 text-xs font-bold text-muted">فیلدهای فرم</div>
        {Object.keys(raw.formFields).length === 0 ? (
          <p className="text-xs text-warn">فرم خالی است؛ همه‌چیز باید از متن استخراج شود.</p>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(raw.formFields).map(([k, v]) => (
                <tr key={k} className="border-b border-line">
                  <td className="py-1 text-muted">{k}</td>
                  <td className="py-1">{v || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <div className="mb-1 text-xs font-bold text-muted">توضیحات</div>
        <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 font-sans text-[13px] leading-7">{raw.description}</pre>
      </div>
      {raw.url && (
        <a href={raw.url} target="_blank" rel="noreferrer" className="text-xs text-brand hover:underline">
          لینک اصلی آگهی
        </a>
      )}
    </div>
  );
}

function NormalizedTab({ l }: { l: NormalizedListing }) {
  const src = (k: string) => (l.extraction.fieldsFromText.includes(k) ? (l.extraction.method === "llm" ? "متن (LLM)" : "متن (قواعد)") : "فرم");
  const rows: [string, string, string][] = [
    ["محله", NEIGHBORHOOD_BY_SLUG[l.neighborhood]?.fa ?? l.neighborhood, "تطبیق نام محله"],
    ["متراژ", `${toPersianDigits(l.areaM2)} متر`, src("areaM2")],
    ["خواب", toPersianDigits(l.rooms), src("rooms")],
    ["طبقه", l.floor != null ? `${toPersianDigits(l.floor)}${l.totalFloors ? ` از ${toPersianDigits(l.totalFloors)}` : ""}` : "نامشخص", src("floor")],
    ["سال ساخت", l.buildYear ? toPersianDigits(l.buildYear) : "نامشخص", src("buildYear")],
    ["ودیعه", fmtToman(l.deposit), "متن قیمت"],
    ["اجاره", l.rent ? fmtToman(l.rent) : "رهن کامل", "متن قیمت"],
    ["پارکینگ", l.amenities.parking ? "دارد" : "ندارد", src("parking")],
    ["آسانسور", l.amenities.elevator ? "دارد" : "ندارد", src("elevator")],
    ["انباری", l.amenities.storage ? "دارد" : "ندارد", src("storage")],
    ["عکس‌ها", l.realPhotos === "yes" ? "واقعی" : l.realPhotos === "decorative" ? "تزئینی" : "نامشخص", "برچسب/متن"],
    ["نزدیک‌ترین مترو", l.nearestMetro ? `${l.nearestMetro.name} | ${toPersianDigits(l.nearestMetro.distanceM)} متر` : "—", "فاصلهٔ تقریبی"],
  ];
  return (
    <div className="space-y-4">
      <div className="num flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs">
        <span>
          روش استخراج: <b>{l.extraction.method === "llm" ? `LLM (${l.extraction.model})` : "قواعد فارسی (بدون LLM)"}</b>
        </span>
        <span>
          اطمینان: <b>{toPersianDigits(Math.round(l.extraction.confidence * 100))}٪</b>
        </span>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            <th className="py-1 text-start font-normal">فیلد</th>
            <th className="py-1 text-start font-normal">مقدار نرمال‌شده</th>
            <th className="py-1 text-start font-normal">منبع</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, v, s]) => (
            <tr key={k} className="border-t border-line">
              <td className="py-1.5 text-muted">{k}</td>
              <td className="num py-1.5 font-medium">{v}</td>
              <td className="py-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${s.startsWith("متن") ? "bg-good-soft text-good" : "bg-gray-100 text-muted"}`}>{s}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded-xl border border-line">
        <div className="border-b border-line px-3 py-2 text-xs font-bold">تبدیل ودیعه و اجاره</div>
        <div className="num space-y-1 px-3 py-2 text-xs">
          {l.convert.mode === "none" ? (
            <p className="text-muted">غیرقابل تبدیل (یا هیچ نشانه‌ای در فرم و متن نبود)</p>
          ) : (
            <>
              <p>
                منبع: <b>{l.convert.mode === "form" ? "گزینهٔ تبدیل در فرم آگهی" : "فقط در متن آگهی"}</b>
              </p>
              <p>
                بازهٔ ودیعه: {fmtToman(l.convert.minDeposit)} تا {fmtToman(l.convert.maxDeposit)}
              </p>
              <p>نرخ مالک: هر ۱۰۰ میلیون رهن = {toPersianDigits((l.convert.rate * 100).toFixed(1).replace(".0", ""))} میلیون اجاره</p>
              {l.convert.evidence && <p className="text-good">شاهد از متن: «{l.convert.evidence}»</p>}
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-line">
        <div className="border-b border-line px-3 py-2 text-xs font-bold">پرچم‌های قرمز پنهان در متن</div>
        <div className="space-y-1 px-3 py-2 text-xs">
          {l.redFlags.length === 0 ? (
            <p className="text-muted">چیزی پیدا نشد</p>
          ) : (
            l.redFlags.map((f) => (
              <p key={f.code}>
                <b className="text-warn">{FLAG_FA[f.code]}</b> <span className="text-muted">← «{f.evidence}»</span>
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ClusterTab({
  result,
  byId,
  rate,
  onPick,
}: {
  result: RankedResult;
  byId: Map<string, NormalizedListing>;
  rate: number;
  onPick: (id: string) => void;
}) {
  const c = result.cluster;
  if (c.memberIds.length === 1)
    return <p className="text-muted">این ملک فقط یک آگهی دارد. هیچ آگهی دیگری با متراژ، طبقه، متن و عکس مشابه در همین محله پیدا نشد.</p>;
  return (
    <div className="space-y-4">
      <p className="text-xs leading-6 text-muted">
        آگهی‌ها فقط وقتی ادغام می‌شوند که در یک محله و با تعداد خواب یکسان باشند، اختلاف متراژشان ≤ ۵ متر باشد، طبقه‌شان فرق نکند و
        علاوه بر مشخصات ساختمان، <b className="text-ink">متن یا عکس مشترک</b> هم داشته باشند (آستانهٔ امتیاز ۰٫۶۸).
      </p>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            <th className="py-1 text-start font-normal">آگهی</th>
            <th className="py-1 text-start font-normal">قیمت آگهی</th>
            <th className="py-1 text-start font-normal">هزینهٔ ماهانهٔ بازار</th>
            <th className="py-1 text-start font-normal">شباهت</th>
          </tr>
        </thead>
        <tbody>
          {c.members.map((m) => {
            const l = byId.get(m.listingId)!;
            const cost = marketMonthly(l.deposit, l.rent, rate);
            const best = m.listingId === c.bestMemberId;
            return (
              <tr key={m.listingId} className={`border-t border-line align-top ${best ? "bg-brand-soft" : ""}`}>
                <td className="py-2">
                  <button onClick={() => onPick(m.listingId)} className="text-start hover:text-brand">
                    <b>{SOURCE_FA[l.source]}</b> | {l.advertiser.kind === "owner" ? "مالک" : l.advertiser.name}
                  </button>
                  {best && <div className="mt-1 inline-block rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">ارزان‌ترین</div>}
                </td>
                <td className="num py-2">
                  {fmtToman(l.deposit, { unit: false })} + {l.rent ? fmtToman(l.rent, { unit: false }) : "۰"}
                </td>
                <td className="num py-2 font-bold">{fmtToman(cost, { unit: false })}</td>
                <td className="num py-2">
                  <Meter label="امتیاز ادغام" value={m.similarity} mark={0.68} tone="bg-brand" />
                  {m.evidence && <Meter label="شباهت متن" value={m.evidence.textCosine} tone="bg-sky-500" />}
                  {m.evidence?.imageOverlap != null && <Meter label="تطابق عکس" value={m.evidence.imageOverlap} tone="bg-emerald-500" />}
                  <div className="text-[10px] text-muted">{m.matchedOn.join("، ")}</div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="num rounded-xl bg-gray-50 p-3 text-xs">
        اختلاف قیمت همین واحد بین آگهی‌ها: <b className="text-good">{fmtToman(c.priceSpread.savings)} در ماه</b>
      </p>
    </div>
  );
}

function ScoreTab({ result, intent }: { result: RankedResult; intent: UserIntent }) {
  if (!result.feasible)
    return <p className="text-muted">این ملک با شرایط فعلی شما حذف شده است، پس امتیازی ندارد.</p>;
  const w = intent.weights;
  const sum = w.cost + w.fairness + w.fit + w.trust + w.commute;
  return (
    <div className="space-y-3">
      <p className="text-xs leading-6 text-muted">
        امتیاز = Σ وزن × نمره. وزن‌ها از جملهٔ شما تنظیم می‌شوند (مثلاً «ارزون» وزن هزینه را بالا می‌برد). تبلیغ‌های پولی مثل «نردبان» هیچ اثری ندارند.
      </p>
      {(Object.keys(WEIGHT_FA) as (keyof Weights)[]).map((k) => {
        const v = result.scoreBreakdown[k];
        return (
          <div key={k}>
            <div className="num mb-1 flex justify-between text-xs">
              <span>{WEIGHT_FA[k]}</span>
              <span className="text-muted">
                نمره {toPersianDigits(Math.round(v * 100))} × وزن {toPersianDigits(Math.round((w[k] / sum) * 100))}٪
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className={`h-2 rounded-full ${SCORE_TONE[k]}`} style={{ width: `${v * 100}%` }} />
            </div>
          </div>
        );
      })}
      <div className="num rounded-xl bg-gray-50 p-3 text-xs">
        هزینهٔ ماهانه با پول شما = اجاره {fmtToman(result.resultingRent, { unit: false })} + رهن {fmtToman(result.chosenDeposit, { unit: false })} ×{" "}
        {toPersianDigits((intent.userRate * 100).toFixed(1))}٪ = <b>{fmtToman(result.effectiveMonthly)}</b>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3 text-[13px]">
      <span className="w-36 shrink-0 text-xs text-muted">{k}</span>
      <span className="num">{v}</span>
    </div>
  );
}
