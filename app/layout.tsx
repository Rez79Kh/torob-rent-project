import type { Metadata, Viewport } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/700.css";
import "@fontsource/vazirmatn/900.css";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ترب اجاره | مقایسهٔ رهن و اجارهٔ تهران با پول نقد شما",
  description:
    "یک بار بگویید چقدر پول نقد دارید؛ ترب اجاره کل بازار رهن و اجارهٔ تهران را با تبدیل ودیعه، قیمت منصفانهٔ محله و ادغام آگهی‌های تکراری رتبه‌بندی می‌کند.",
  icons: {
    icon: "/torob-logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f31d3a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
