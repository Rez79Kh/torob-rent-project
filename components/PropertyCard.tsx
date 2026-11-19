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

  return (
    <article
      id={`card-${id}`}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      className={`scroll-mt-40 rounded-2xl border bg-white p-4 transition ${active ? "border-[#f31d3a] ring-2 ring-[#f31d3a]" : "border-line hover:border-[#d1d5db]"}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`num flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
            rank <= 3 ? "bg-brand text-white" : "bg-gray-100 text-muted"
          }`}
        >
          {toPersianDigits(rank)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="num text-[15px] font-black">
              {toPersianDigits(l.areaM2)} متر | {l.rooms === 0 ? "سوئیت" : `${toPersianDigits(l.rooms)} خواب`} | {hood?.fa}
            </h2>
            {r.unlockedByConversion && (
              <span className="rounded-md bg-good px-2 py-0.5 text-[11px] font-bold text-white" title="با تبدیل نقدینگی شما باز شد">
                فقط با تبدیل پیدا شد
              </span>
            )}
            {l.convert.mode === "text" && (
              <span className="rounded-md bg-good-soft px-2 py-0.5 text-[11px] font-bold text-good" title={`از متن آگهی: «${l.convert.evidence ?? ""}»`}>
                تبدیل پنهان در متن
              </span>
            )}
            {l.isSeed && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">دادهٔ نمونه</span>}
            {members > 1 && (
              <button
                type="button"
                onClick={() => setCompareOpen((open) => !open)}
                aria-expanded={compareOpen}
                className="num inline-flex items-center rounded-full bg-brand px-2.5 py-1 text-[11px] font-bold text-white hover:opacity-90"
              >
                در {toPersianDigits(members)} آگهی · صرفه‌جویی {fmtToman(r.cluster.priceSpread.savings, { unit: false })}
              </button>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted" title={l.title}>
            {l.title}
          </p>
        </div>
        <div className="shrink-0 text-end">
          <div className="text-[11px] text-muted">هزینهٔ واقعی ماهانه</div>
          <div className="num text-lg font-black">{fmtToman(r.effectiveMonthly, { unit: false })}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <div className="num rounded-xl bg-gray-50 px-3 py-2 text-[13px]">
          <span className="text-muted">با پول شما: </span>
          <b>رهن {fmtToman(r.chosenDeposit, { unit: false })}</b>
          <span className="text-muted"> + </span>
          <b>{r.resultingRent === 0 ? "بدون اجاره" : `اجاره ${fmtToman(r.resultingRent, { unit: false })}`}</b>
          {l.convert.mode !== "none" && l.convert.rate < userRate && r.chosenDeposit < cash && (
            <span className="block text-[11px] font-medium text-good">
              {fmtToman(cash - r.chosenDeposit, { unit: false })} از پولتان آزاد می‌ماند؛ نرخ تبدیل این مالک (
              {toPersianDigits((l.convert.rate * 100).toFixed(1).replace(".0", ""))}٪) از سود پول شما کمتر است
            </span>
          )}
          {converted && (
            <span className="block text-[11px] text-muted">
              قیمت آگهی: رهن {fmtToman(l.deposit, { unit: false })} + اجاره {fmtToman(l.rent, { unit: false })} | نرخ تبدیل مالک{" "}
              {toPersianDigits((l.convert.rate * 100).toFixed(1).replace(".0", ""))}٪
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <FairPriceBadge deltaPct={r.fairDeltaPct} effPerM2={r.effPerM2} stats={stats} />
        </div>
      </div>

      {members > 1 && compareOpen && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[28rem] text-xs">
            <thead>
              <tr className="bg-gray-50 text-muted">
                <th className="px-3 py-2 text-start font-normal">منبع</th>
                <th className="px-3 py-2 text-start font-normal">آژانس</th>
                <th className="px-3 py-2 text-start font-normal">رهن + اجاره</th>
                <th className="px-3 py-2 text-start font-normal">آگهی</th>
              </tr>
            </thead>
            <tbody>
              {r.cluster.members.map((member) => {
                const row = data.listings.find((item) => item.id === member.listingId);
                if (!row) return null;
                const agency = row.advertiser.kind === "owner" ? "مالک" : (row.advertiser.name ?? "آژانس");
                return (
                  <tr key={member.listingId} className="border-t border-line">
                    <td className="px-3 py-2 font-bold">{SOURCE_FA[row.source]}</td>
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

      <div className="num mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {l.floor != null && (
          <span>
            طبقه {toPersianDigits(l.floor)}
            {l.totalFloors ? ` از ${toPersianDigits(l.totalFloors)}` : ""}
          </span>
        )}
        {age != null && <span>{age <= 1 ? "نوساز" : `${toPersianDigits(age)} سال ساخت`}</span>}
        {l.nearestMetro && (
          <span className={l.nearestMetro.distanceM <= 1200 ? "text-ink" : ""}>
            مترو {l.nearestMetro.name}: {toPersianDigits(Math.round(l.nearestMetro.distanceM / 50) * 50)} متر
          </span>
        )}
        <Amenity on={l.amenities.parking} label="پارکینگ" />
        <Amenity on={l.amenities.elevator} label="آسانسور" />
        <Amenity on={l.amenities.storage} label="انباری" />
        {l.amenities.balcony && <Amenity on label="بالکن" />}
        <span>{l.advertiser.kind === "owner" ? "از مالک" : l.advertiser.name}</span>
        {l.realPhotos === "yes" && <span className="text-good">عکس واقعی</span>}
      </div>

      {l.redFlags.length > 0 && (
        <div className="mt-2">
          <RedFlags flags={l.redFlags} />
        </div>
      )}

      {explanation && rank === 1 && (
        <div className="mt-3">
          <WhyBest explanation={explanation} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <button onClick={() => onInspect(id)} className="text-xs font-bold text-ink hover:text-brand">
          بازرس پایپ‌لاین داده (خام در برابر نرمال‌شده)
        </button>
        <div className="num flex items-center gap-3 text-[11px] text-muted">
          <span title="امتیاز نهایی با وزن‌های فعلی شما">امتیاز {toPersianDigits(Math.round(r.score * 100))}</span>
          {l.url && (
            <a href={l.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
              مشاهده در {SOURCE_FA[l.source]}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function Amenity({ on, label }: { on: boolean; label: string }) {
  return <span className={on ? "text-ink" : "text-slate-400 line-through"}>{label}</span>;
}

export default memo(PropertyCard);
