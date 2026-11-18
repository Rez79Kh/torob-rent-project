"use client";

import { memo } from "react";
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
  const members = r.cluster.memberIds.length;
  const sources = r.cluster.memberIds.reduce<Record<string, number>>((acc, id) => {
    const src = data.listings.find((x) => x.id === id)?.source ?? "divar";
    acc[src] = (acc[src] ?? 0) + 1;
    return acc;
  }, {});
  const converted = r.chosenDeposit !== l.deposit;
  const age = l.buildYear ? CURRENT_JALALI_YEAR - l.buildYear : null;
  const id = r.cluster.clusterId;

  return (
    <article
      id={`card-${id}`}
      onMouseEnter={() => onHover(id)}
      onMouseLeave={() => onHover(null)}
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 transition ${active ? "ring-2 ring-brand" : "ring-line hover:ring-gray-300"}`}
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
              <span className="rounded-md bg-good px-2 py-0.5 text-[11px] font-bold text-white" title="با فیلتر ودیعه/اجارهٔ دیوار دیده نمی‌شد">
                فقط با تبدیل پیدا شد
              </span>
            )}
            {l.convert.mode === "text" && (
              <span className="rounded-md bg-good-soft px-2 py-0.5 text-[11px] font-bold text-good" title={`از متن آگهی: «${l.convert.evidence ?? ""}»`}>
                تبدیل پنهان در متن
              </span>
            )}
            {l.isSeed && <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-400">دادهٔ نمونه</span>}
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

      {members > 1 && (
        <div className="num mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed border-brand/30 px-3 py-2 text-[13px]">
          <b className="text-brand">همین ملک در {toPersianDigits(members)} آگهی</b>
          <span className="text-muted">
            ({Object.entries(sources)
              .map(([s, n]) => `${SOURCE_FA[s as Source]} ${toPersianDigits(n)}`)
              .join("، ")})
          </span>
          <span>
            از {fmtToman(r.cluster.priceSpread.minEffective, { unit: false })} تا {fmtToman(r.cluster.priceSpread.maxEffective, { unit: false })}
          </span>
          {r.cluster.priceSpread.savings > 0 && (
            <span className="font-bold text-good">صرفه‌جویی {fmtToman(r.cluster.priceSpread.savings, { unit: false })} در ماه بین آگهی‌های همین واحد</span>
          )}
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
  return <span className={on ? "text-ink" : "text-gray-300 line-through"}>{label}</span>;
}

export default memo(PropertyCard);
