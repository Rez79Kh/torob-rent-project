"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClientData } from "@/lib/data";
import { explainTop } from "@/lib/explain";
import { DEFAULT_INTENT, parseIntentRules } from "@/lib/intent/rules";
import { toPersianDigits } from "@/lib/persian";
import { rankMarket, REJECT_LABEL } from "@/lib/rank";
import type { Explanation, UserIntent } from "@/lib/types";
import CashBar from "./CashBar";
import IntentInput from "./IntentInput";
import PipelineInspector from "./PipelineInspector";
import PropertyCard from "./PropertyCard";

const MarketMap = dynamic(() => import("./MarketMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-gray-100" />,
});

const PAGE = 30;

export default function SearchShell({ data, llmEnabled }: { data: ClientData; llmEnabled: boolean }) {
  const [intent, setIntent] = useState<UserIntent>(DEFAULT_INTENT);
  const [parsing, setParsing] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [mobileMap, setMobileMap] = useState(false);
  const [llmExplain, setLlmExplain] = useState<Explanation | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const out = useMemo(() => {
    const t = performance.now();
    const r = rankMarket(data, intent);
    return { ...r, ms: performance.now() - t };
  }, [data, intent]);

  const templateExplain = useMemo(() => explainTop(out.ranked, intent), [out.ranked, intent]);
  const topKey = out.ranked.slice(0, 3).map((r) => `${r.cluster.clusterId}:${r.effectiveMonthly}`).join("|");

  useEffect(() => {
    setLlmExplain(null);
    if (!llmEnabled || out.ranked.length < 2) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bullets: templateExplain.bullets }),
        });
        if (res.ok) setLlmExplain((await res.json()) as Explanation);
      } catch {
        /* template stays */
      }
    }, 700);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topKey, llmEnabled]);

  const explanation = llmExplain?.bullets.length ? llmExplain : templateExplain;

  const onQuery = useCallback(
    async (q: string) => {
      const local = parseIntentRules(q, { ...intent, rawQuery: q });
      setIntent(local);
      setLimit(PAGE);
      if (!llmEnabled || !q.trim()) return;
      setParsing(true);
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q, base: { ...intent, rawQuery: q } }),
        });
        if (res.ok) setIntent((await res.json()) as UserIntent);
      } catch {
        /* rules result stays */
      } finally {
        setParsing(false);
      }
    },
    [intent, llmEnabled],
  );

  const listRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(230);
  const pendingScroll = useRef<string | null>(null);
  const selectFromMap = useCallback((clusterId: string) => {
    pendingScroll.current = clusterId;
    setSelectedId(clusterId);
    setLimit((current) => {
      const index = out.ranked.findIndex((item) => item.cluster.clusterId === clusterId);
      return index < 0 ? current : Math.max(current, index + 1);
    });
  }, [out.ranked]);

  useEffect(() => {
    const el = dockRef.current;
    if (!el) return;
    const measure = () => setDockH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const clusterId = pendingScroll.current;
    if (!clusterId) return;
    const el = document.getElementById(`card-${clusterId}`);
    if (!el) return;
    pendingScroll.current = null;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedId, limit]);

  const totalListings = data.listings.length;
  const inspected = inspectId ? [...out.ranked, ...out.rejected].find((r) => r.cluster.clusterId === inspectId) : null;

  return (
    <div className="min-h-screen">
      <div ref={dockRef} className="command-dock sticky top-0 z-[1100] border-b border-white/70">
        <div className="mx-auto max-w-[1440px] px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/torob-logo.png" alt="ترب اجاره" width={34} height={34} />
              <h1 className="text-lg font-black leading-none">
                ترب <span className="text-brand">اجاره</span>
              </h1>
            </div>
            <span className="num rounded-full border border-line bg-white px-3 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
              {toPersianDigits(data.clusters.length)} ملک یکتا از {toPersianDigits(data.stats.rawCount)} آگهی
            </span>
          </div>
          <div className="mt-2">
            <IntentInput intent={intent} parsing={parsing} llmEnabled={llmEnabled} onQuery={onQuery} onChange={setIntent} />
          </div>
          <div className="mt-2">
            <CashBar intent={intent} onChange={(i) => setIntent(i)} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            <span className="num font-bold text-ink">{toPersianDigits(out.ranked.length)} ملک مناسب شما</span>
            {out.unlockedCount > 0 && <span className="num text-emerald-600">{toPersianDigits(out.unlockedCount)} تا با تبدیل نقدینگی شما باز شد</span>}
            <span className="num">{toPersianDigits(totalListings - data.clusters.length)} آگهی تکراری ادغام شد</span>
            {mounted && (
              <span className="num ms-auto" title="زمان رتبه‌بندی کل بازار در مرورگر">
                رتبه‌بندی {toPersianDigits(Math.max(out.ms, 0.1).toFixed(1))} میلی‌ثانیه
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-4">
        <div className="mt-4 grid grid-cols-1 gap-4 pb-16 lg:grid-cols-12">
          <div ref={listRef} className="flex flex-col gap-3 lg:col-span-7">
            {out.ranked.length === 0 && (
              <div className="rounded-2xl border border-line bg-white p-8 text-center">
                <p className="text-lg font-bold">با این پول و سقف اجاره چیزی پیدا نشد</p>
                <p className="mt-2 text-sm text-muted">
                  اسلایدر پول نقد یا سقف اجاره را کمی جابه‌جا کنید؛ بیشترین دلیل حذف:{" "}
                  {REJECT_LABEL[Object.entries(out.rejectCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "cash"]}
                </p>
              </div>
            )}
            {out.ranked.slice(0, limit).map((r, i) => (
              <PropertyCard
                key={r.cluster.clusterId}
                rank={i + 1}
                result={r}
                data={data}
                cash={intent.cash}
                userRate={intent.userRate}
                explanation={i === 0 ? explanation : undefined}
                active={hoverId === r.cluster.clusterId || selectedId === r.cluster.clusterId}
                onHover={setHoverId}
                onInspect={setInspectId}
              />
            ))}
            {out.ranked.length > limit && (
              <button
                onClick={() => setLimit((l) => l + PAGE)}
                className="rounded-xl border border-line bg-white py-3 text-sm font-bold text-brand hover:border-brand hover:bg-brand-soft"
              >
                نمایش {toPersianDigits(Math.min(PAGE, out.ranked.length - limit))} ملک دیگر
              </button>
            )}

            {out.rejected.length > 0 && (
              <div className="rounded-2xl border border-line bg-white">
                <button onClick={() => setShowRejected((s) => !s)} className="flex w-full items-center justify-between px-4 py-3 text-sm">
                  <span className="font-bold num">{toPersianDigits(out.rejected.length)} ملک حذف‌شده و دلیلش</span>
                  <span className="text-muted">{showRejected ? "بستن" : "نمایش"}</span>
                </button>
                <div className="flex flex-wrap gap-2 px-4 pb-3">
                  {Object.entries(out.rejectCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, n]) => (
                      <span key={k} className="num rounded-full bg-gray-100 px-2.5 py-1 text-xs text-muted">
                        {REJECT_LABEL[k]}: {toPersianDigits(n)}
                      </span>
                    ))}
                </div>
                {showRejected && (
                  <ul className="divide-y divide-line border-t border-line text-sm">
                    {out.rejected.slice(0, 60).map((r) => (
                      <li key={r.cluster.clusterId} className="flex items-center justify-between gap-3 px-4 py-2">
                        <button className="truncate text-start hover:text-brand" onClick={() => setInspectId(r.cluster.clusterId)}>
                          {r.listing.title}
                        </button>
                        <span className="shrink-0 text-xs text-muted">{REJECT_LABEL[r.rejectReason ?? "cash"]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div
            className={`map-pane ${
              mobileMap ? "fixed inset-x-0 bottom-0 z-[1000] h-[70vh] rounded-t-3xl bg-white p-2 shadow-2xl" : "hidden"
            } lg:sticky lg:col-span-5 lg:block lg:p-0 lg:shadow-none`}
            style={{ ["--dock" as string]: `${dockH}px` }}
          >
            <MarketMap
              data={data}
              ranked={out.ranked}
              hoverId={hoverId}
              selectedId={selectedId}
              onHover={setHoverId}
              onSelect={selectFromMap}
            />
          </div>
        </div>
      </div>

      <footer className="mt-6 border-t border-line bg-white pb-20 lg:pb-0">
        <p className="mx-auto max-w-[1400px] px-4 py-3 text-center text-[11px] leading-6 text-muted">
          نمونه‌ی آزمایشی ساخته‌شده برای چالش AI Product Engineer ترب
        </p>
      </footer>

      <button
        onClick={() => setMobileMap((m) => !m)}
        className="fixed bottom-4 left-1/2 z-[1001] -translate-x-1/2 rounded-full bg-brand px-5 py-3 text-sm font-bold text-white shadow-lg lg:hidden"
      >
        {mobileMap ? "بستن نقشه" : "نمایش روی نقشه"}
      </button>

      {inspected && <PipelineInspector result={inspected} data={data} intent={intent} onClose={() => setInspectId(null)} />}
    </div>
  );
}
