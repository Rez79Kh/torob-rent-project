import { fairBand } from "@/lib/fairPrice";
import { NEIGHBORHOOD_BY_SLUG } from "@/lib/geo";
import { fmtPct, fmtToman } from "@/lib/money";
import type { NeighborhoodStats } from "@/lib/types";

export default function FairPriceBadge({
  deltaPct,
  effPerM2,
  stats,
}: {
  deltaPct: number;
  effPerM2: number;
  stats?: NeighborhoodStats;
}) {
  const band = fairBand(deltaPct);
  const hood = stats ? NEIGHBORHOOD_BY_SLUG[stats.slug]?.fa : "";
  const tone =
    band === "good" ? "bg-good-soft text-good" : band === "high" ? "bg-bad-soft text-bad" : "bg-gray-100 text-muted";
  const label =
    Math.abs(deltaPct) < 2 ? `هم‌قیمت میانگین ${hood}` : `${fmtPct(deltaPct)} ${deltaPct < 0 ? "زیر" : "بالای"} میانگین ${hood}`;

  // Position on a strip from 0.6× to 1.4× the neighborhood median.
  const pos = stats ? Math.min(100, Math.max(0, ((effPerM2 / stats.medianEffPerM2 - 0.6) / 0.8) * 100)) : 50;
  const p25 = stats ? ((stats.p25 / stats.medianEffPerM2 - 0.6) / 0.8) * 100 : 40;
  const p75 = stats ? ((stats.p75 / stats.medianEffPerM2 - 0.6) / 0.8) * 100 : 60;

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs font-bold ${tone}`}
      title={stats ? `اجارهٔ مؤثر هر متر: ${fmtToman(effPerM2)} | میانه ${hood}: ${fmtToman(stats.medianEffPerM2)}` : ""}
    >
      <span className="num">{label}</span>
      {stats && (
        <span className="relative h-1.5 w-16 rounded-full bg-white/70" dir="ltr" aria-hidden>
          <span className="absolute top-0 h-1.5 rounded-full bg-current opacity-25" style={{ left: `${p25}%`, width: `${p75 - p25}%` }} />
          <span className="absolute -top-0.5 h-2.5 w-px bg-current opacity-60" style={{ left: "50%" }} />
          <span className="absolute -top-[3px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white bg-current" style={{ left: `${pos}%` }} />
        </span>
      )}
    </div>
  );
}
