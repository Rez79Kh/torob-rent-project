"use client";

import { memo, useState } from "react";
import type { ClientData } from "@/lib/data";
import { NEIGHBORHOOD_BY_SLUG } from "@/lib/geo";
import { fmtToman } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
import { CURRENT_JALALI_YEAR } from "@/lib/rank";
import type { Explanation, RankedResult, Source } from "@/lib/types";
import FairPriceBadge from "./FairPriceBadge";
import RedFlags from "./RedFlags";
import WhyBest from "./WhyBest";

export const SOURCE_FA: Record<Source, string> = { divar: "دیوار", sheypoor: "شیپور", kilid: "کیلید" };

const SOURCE_TONE: Record<Source, string> = {
  divar: "bg-rose-50 text-rose-700",
  sheypoor: "bg-amber-50 text-amber-700",
  kilid: "bg-sky-50 text-sky-700",
};

function PropertyCard({
  rank,
  result: r,
  data,
  cash,
  userRate,
  explanation,
  active,
  onHover,
  onInspect,
}: {
  rank: number;
  result: RankedResult;
  data: ClientData;
  cash: number;
  userRate: number;
  explanation?: Explanation;
  active: boolean;
  onHover: (id: string | null) => void;
  onInspect: (id: string) => void;
}) {
  const l = r.listing;
  const hood = NEIGHBORHOOD_BY_SLUG[l.neighborhood];
  const stats = data.neighborhoods.find((n) => n.slug === l.neighborhood);
  const [compareOpen, setCompareOpen] = useState(false);
  const members = r.cluster.members.length;
  const converted = r.chosenDeposit !== l.deposit;
  const age = l.buildYear ? CURRENT_JALALI_YEAR - l.buildYear : null;
  const id = r.cluster.clusterId;
  const spotlight = rank === 1;

  return (
    <article
      id={`card-${id}`}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      className={`scroll-mt-44 rounded-2xl border bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        active ? "border-[#f31d3a] ring-2 ring-[#f31d3a]" : spotlight ? "border-[#f31d3a]/20 ring-2 ring-[#f31d3a]/25" : "border-line"
      }`}
    >
      <div className="flex items-start gap-3">
        {spotlight && <PreviewCard hood={hood?.fa ?? ""} real={l.realPhotos === "yes"} seed={l.isSeed} />}
        <div
          className={`num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
            rank <= 3 ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {toPersianDigits(rank)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {spotlight && (
              <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-black text-white">بهترین انتخاب برای نقدینگی شما</span>
            )}
            {r.unlockedByConversion && (
              <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white" title="با تبدیل نقدینگی شما باز شد">
                با تبدیل نقدینگی شما باز شد
              </span>
            )}
            {l.convert.mode === "text" && (
              <span className="rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-bold text-good" title={`از متن آگهی: «${l.convert.evidence ?? ""}»`}>
                تبدیل پنهان در متن
              </span>
            )}
          </div>
          <h2 className="num mt-1 text-[15px] font-black leading-6">
            {toPersianDigits(l.areaM2)} متر | {l.rooms === 0 ? "سوئیت" : `${toPersianDigits(l.rooms)} خواب`} | {hood?.fa}
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted" title={l.title}>
            {l.title}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl bg-slate-50 px-3 py-2 text-end">
          <div className="text-[10px] font-bold text-slate-500">هزینهٔ واقعی ماهانه</div>
          <div className="num text-xl font-black tracking-tight text-ink">{fmtToman(r.effectiveMonthly, { unit: false })}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Spec label={`${toPersianDigits(l.areaM2)} متر`} />
        <Spec label={l.rooms === 0 ? "سوئیت" : `${toPersianDigits(l.rooms)} خواب`} />
        {l.floor != null && <Spec label={`طبقه ${toPersianDigits(l.floor)}${l.totalFloors ? ` از ${toPersianDigits(l.totalFloors)}` : ""}`} />}
        {age != null && <Spec label={age <= 1 ? "نوساز" : `${toPersianDigits(age)} سال ساخت`} />}
        {l.nearestMetro && (
          <Spec
            strong={l.nearestMetro.distanceM <= 1200}
            label={`مترو ${l.nearestMetro.name} · ${toPersianDigits(Math.round(l.nearestMetro.distanceM / 50) * 50)} متر`}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="num rounded-full bg-ink px-3 py-1 text-[12px] font-bold text-white">
          رهن شما: {fmtToman(r.chosenDeposit, { unit: false })} | اجاره شما: {r.resultingRent === 0 ? "۰" : fmtToman(r.resultingRent, { unit: false })}
        </span>
        <span className="num text-[11px] text-slate-400">
          قیمت اولیه آگهی: رهن {fmtToman(l.deposit, { unit: false })} + اجاره {fmtToman(l.rent, { unit: false })}
        </span>
        <FairPriceBadge deltaPct={r.fairDeltaPct} effPerM2={r.effPerM2} stats={stats} />
      </div>
      {l.convert.mode !== "none" && l.convert.rate < userRate && r.chosenDeposit < cash && (
        <p className="num mt-1.5 text-[11px] font-medium text-good">
          {fmtToman(cash - r.chosenDeposit, { unit: false })} از پولتان آزاد می‌ماند؛ نرخ تبدیل این مالک (
          {toPersianDigits((l.convert.rate * 100).toFixed(1).replace(".0", ""))}٪) از سود پول شما کمتر است
        </p>
      )}
      {converted && (
        <p className="num mt-1 text-[11px] text-muted">
          نرخ تبدیل مالک {toPersianDigits((l.convert.rate * 100).toFixed(1).replace(".0", ""))}٪
        </p>
      )}

      <div className="num mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Amenity on={l.amenities.parking} label="پارکینگ" />
        <Amenity on={l.amenities.elevator} label="آسانسور" />
        <Amenity on={l.amenities.storage} label="انباری" />
        {l.amenities.balcony && <Amenity on label="بالکن" />}
        <span className="text-muted">{l.advertiser.kind === "owner" ? "از مالک" : l.advertiser.name}</span>
        {l.isSeed && !spotlight && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-400">دادهٔ نمونه</span>}
        {l.realPhotos === "yes" && !spotlight && <span className="text-good">عکس واقعی</span>}
      </div>

      {members > 1 && (
        <button
          type="button"
          onClick={() => setCompareOpen((open) => !open)}
          aria-expanded={compareOpen}
          className="num mt-3 inline-flex items-center rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:brightness-110"
        >
          مقایسه {toPersianDigits(members)} آگهی · صرفه‌جویی {fmtToman(r.cluster.priceSpread.savings, { unit: false })}
        </button>
      )}

      {members > 1 && compareOpen && (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[28rem] text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500">
                <th className="px-3 py-2 text-start font-medium">منبع</th>
                <th className="px-3 py-2 text-start font-medium">آژانس</th>
                <th className="px-3 py-2 text-start font-medium">رهن + اجاره</th>
                <th className="px-3 py-2 text-start font-medium">آگهی</th>
              </tr>
            </thead>
            <tbody>
              {r.cluster.members.map((member, index) => {
                const row = data.listings.find((item) => item.id === member.listingId);
                if (!row) return null;
                const agency = row.advertiser.kind === "owner" ? "مالک" : (row.advertiser.name ?? "آژانس");
                return (
                  <tr key={member.listingId} className={index % 2 ? "bg-slate-50/80" : "bg-white"}>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${SOURCE_TONE[row.source]}`}>{SOURCE_FA[row.source]}</span>
                    </td>
                    <td className="px-3 py-2">{agency}</td>
                    <td className="num px-3 py-2">
                      {fmtToman(row.deposit, { unit: false })} + {row.rent ? fmtToman(row.rent, { unit: false }) : "۰"}
                    </td>
                    <td className="px-3 py-2">
                      {row.url ? (
                        <a href={row.url} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">
                          مشاهده
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {l.redFlags.length > 0 && (
        <div className="mt-3">
          <RedFlags flags={l.redFlags} />
        </div>
      )}

      {explanation && rank === 1 && (
        <div className="mt-3">
          <WhyBest explanation={explanation} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        <button onClick={() => onInspect(id)} className="text-xs font-bold text-ink hover:text-brand">
          بازرس پایپ‌لاین داده
        </button>
        <div className="num flex items-center gap-3 text-[11px] text-muted">
          <span title="امتیاز نهایی با وزن‌های فعلی شما">امتیاز {toPersianDigits(Math.round(r.score * 100))}</span>
          {l.url && (
            <a href={l.url} target="_blank" rel="noreferrer" className="font-bold text-brand hover:underline">
              مشاهده در {SOURCE_FA[l.source]}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function PreviewCard({ hood, real, seed }: { hood: string; real: boolean; seed: boolean }) {
  return (
    <div className="relative hidden h-[4.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-2xl bg-gradient-to-b from-rose-100 to-slate-100 sm:block">
      <svg viewBox="0 0 88 72" className="h-full w-full" aria-hidden>
        <rect x="8" y="28" width="72" height="36" rx="4" fill="#fff" />
        <path d="M10 30 L44 10 L78 30" fill="none" stroke="#f31d3a" strokeWidth="3" />
        <rect x="36" y="42" width="16" height="22" rx="2" fill="#f31d3a" />
        <rect x="16" y="38" width="14" height="12" rx="1.5" fill="#e2e8f0" />
        <rect x="58" y="38" width="14" height="12" rx="1.5" fill="#e2e8f0" />
      </svg>
      <span className="absolute inset-x-1 bottom-1 truncate rounded-full bg-white/90 px-1.5 text-center text-[9px] font-bold text-slate-600">{hood}</span>
      {real ? (
        <span className="absolute start-1 top-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[8px] font-bold text-white">عکس واقعی</span>
      ) : (
        seed && <span className="absolute start-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[8px] font-bold text-slate-500">دادهٔ نمونه</span>
      )}
    </div>
  );
}

function Spec({ label, strong }: { label: string; strong?: boolean }) {
  return <span className={`num rounded-full bg-slate-100 px-2.5 py-1 text-[11px] ${strong ? "font-bold text-ink" : "text-slate-600"}`}>{label}</span>;
}

function Amenity({ on, label }: { on: boolean; label: string }) {
  return <span className={on ? "text-ink" : "text-slate-400 line-through"}>{label}</span>;
}

export default memo(PropertyCard);
