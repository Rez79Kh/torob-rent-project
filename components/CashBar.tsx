"use client";

import { useState } from "react";
import { fmtToman } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
import type { UserIntent } from "@/lib/types";

const CASH_MIN = 100e6;
const CASH_MAX = 20e9;
const RENT_MAX = 150e6;

const toPos = (cash: number) => (Math.log(cash / CASH_MIN) / Math.log(CASH_MAX / CASH_MIN)) * 1000;
const fromPos = (p: number) => {
  const v = CASH_MIN * (CASH_MAX / CASH_MIN) ** (p / 1000);
  const step = v >= 2e9 ? 100e6 : 50e6;
  return Math.round(v / step) * step;
};

export default function CashBar({ intent, onChange }: { intent: UserIntent; onChange: (i: UserIntent) => void }) {
  const [advanced, setAdvanced] = useState(false);
  const cashPos = toPos(Math.min(Math.max(intent.cash, CASH_MIN), CASH_MAX));
  const rentPct = (Math.min(intent.maxRent, RENT_MAX) / RENT_MAX) * 100;

  return (
    <div className="relative grid grid-cols-2 gap-2">
      <label className="rounded-2xl border border-line bg-white px-3 py-2 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)]">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500">مقدار پول نقد من</span>
          <span className="num text-sm font-black text-brand md:text-base">{fmtToman(intent.cash)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          value={cashPos}
          aria-label="مقدار پول نقد من"
          onChange={(e) => onChange({ ...intent, cash: fromPos(Number(e.target.value)) })}
          className="cash-range w-full"
          style={{ ["--fill" as string]: `${cashPos / 10}%` }}
        />
      </label>

      <label className="rounded-2xl border border-line bg-white px-3 py-2 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)]">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500">سقف اجارهٔ ماهانه</span>
          <span className="num text-sm font-black text-ink md:text-base">{intent.maxRent === 0 ? "فقط رهن کامل" : fmtToman(intent.maxRent)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={RENT_MAX}
          step={1e6}
          value={Math.min(intent.maxRent, RENT_MAX)}
          aria-label="سقف اجارهٔ ماهانه"
          onChange={(e) => onChange({ ...intent, maxRent: Number(e.target.value) })}
          className="cash-range w-full"
          style={{ ["--fill" as string]: `${rentPct}%` }}
        />
      </label>

      <div className="col-span-2 flex justify-end">
        <button
          type="button"
          onClick={() => setAdvanced((a) => !a)}
          className="rounded-full px-2 py-0.5 text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-ink"
          aria-expanded={advanced}
        >
          نرخ تبدیل و ارزش پول
        </button>
        {advanced && (
          <div className="absolute end-0 top-full z-20 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 text-sm shadow-[0_16px_40px_-20px_rgba(15,23,42,0.45)]">
            <p className="mb-3 leading-7 text-muted">
              صاحب‌خانه‌ها معمولاً هر <b className="text-ink">۱۰۰ میلیون</b> رهن بیشتر را با <b className="text-ink">۳ میلیون</b> اجارهٔ کمتر عوض
              می‌کنند (۳٪ در ماه). اگر پول شما جای دیگری کمتر از این سود می‌دهد، گذاشتن پول بیشتر در رهن به‌صرفه است.
            </p>
            <label className="block">
              <div className="mb-1 flex justify-between">
                <span>سود ماهانهٔ پول شما در جای دیگر</span>
                <span className="num font-bold">{toPersianDigits((intent.userRate * 100).toFixed(1))}٪</span>
              </div>
              <input
                type="range"
                min={0.01}
                max={0.04}
                step={0.001}
                value={intent.userRate}
                onChange={(e) => onChange({ ...intent, userRate: Number(e.target.value) })}
                className="cash-range w-full"
                style={{ ["--fill" as string]: `${((intent.userRate - 0.01) / 0.03) * 100}%` }}
              />
              <p className="num mt-1 text-[11px] text-muted">
                معادل سالانه حدود {toPersianDigits(Math.round(((1 + intent.userRate) ** 12 - 1) * 100))}٪ (سپرده بانکی حدود ۲۵ تا ۳۰٪)
              </p>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
