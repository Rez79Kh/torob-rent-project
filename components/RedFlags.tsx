import type { RedFlag, RedFlagCode } from "@/lib/types";

export const FLAG_FA: Record<RedFlagCode, string> = {
  family_only: "فقط خانواده",
  couple_only: "فقط زوج",
  no_single: "به مجرد نمی‌دهد",
  shared_parking: "پارکینگ مشاع",
  mozahem_parking: "پارکینگ مزاحم‌دار",
  evict_end_of_month: "زمان تخلیه محدود",
  decorative_photos: "عکس تزئینی",
  placeholder_price: "قیمت غیرواقعی",
  non_apartment: "آپارتمان نیست",
  commission_extra: "کمیسیون جداگانه",
  short_contract: "قرارداد کوتاه",
  basement_unit: "زیرزمین/زیرهمکف",
  no_elevator_high_floor: "طبقهٔ بالا بی‌آسانسور",
};

export default function RedFlags({ flags, blocking = [] }: { flags: RedFlag[]; blocking?: RedFlagCode[] }) {
  if (!flags.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <span
          key={f.code}
          title={`از متن آگهی: «${f.evidence}»`}
          className={`cursor-help rounded-md px-2 py-0.5 text-[11px] font-medium ${
            blocking.includes(f.code) ? "bg-bad text-white" : "bg-warn-soft text-warn"
          }`}
        >
          {FLAG_FA[f.code]}
        </span>
      ))}
    </div>
  );
}
