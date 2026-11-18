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
    <div className="sticky top-0 z-[1100] border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-x-4 gap-y-2 px-4 py-2.5 md:gap-x-8 md:py-3 md:grid-cols-[1.3fr_1fr_auto]">
        <label className="block">
          <div className="mb-1.5 flex flex-col items-start md:flex-row md:items-baseline md:justify-between">
            <span className="text-xs font-bold md:text-sm">مقدار پول نقد من</span>
            <span className="num text-base font-black md:text-xl text-brand">{fmtToman(intent.cash)}</span>
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
          <div className="num mt-1 hidden justify-between text-[11px] md:flex text-muted">
            <span>۱۰۰ میلیون</span>
            <span>۱ میلیارد</span>
            <span>۵ میلیارد</span>
            <span>۲۰ میلیارد</span>
          </div>
        </label>

        <label className="block">
          <div className="mb-1.5 flex flex-col items-start md:flex-row md:items-baseline md:justify-between">
            <span className="text-xs font-bold md:text-sm">سقف اجارهٔ ماهانه</span>
            <span className="num text-base font-black md:text-xl">{intent.maxRent === 0 ? "فقط رهن کامل" : fmtToman(intent.maxRent)}</span>
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
          <div className="num mt-1 hidden justify-between text-[11px] md:flex text-muted">
            <span>۰</span>
            <span>۵۰ میلیون</span>
            <span>۱۰۰ میلیون</span>
            <span>۱۵۰ میلیون</span>
          </div>
        </label>

        <div className="relative col-span-2 flex items-center md:col-span-1">
          <button
            onClick={() => setAdvanced((a) => !a)}
            className="rounded-lg px-3 py-1.5 text-xs text-muted md:py-2 ring-1 ring-line hover:bg-gray-50"
            aria-expanded={advanced}
          >
            نرخ تبدیل و ارزش پول
          </button>
          {advanced && (
            <div className="absolute end-0 top-full z-10 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl bg-white p-4 text-sm shadow-xl ring-1 ring-line">
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
    </div>
  );
}
