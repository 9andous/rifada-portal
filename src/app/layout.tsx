import type { Metadata } from "next";
import { Suspense } from "react";
import { SupportWidget } from "@/components/layout/support-widget";
import { themeInitScript } from "@/components/layout/theme-toggle";
import { brand } from "@/config/brand";
import { fontVariables } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${brand.productName} — ${brand.unitName}`,
    template: `%s — ${brand.productName}`,
  },
  description: "منصة الإشراف الفني على الجمعيات الخيرية والتطوعية المقدمة لخدماتها لقاصدي الحرمين الشريفين.",
  icons: { icon: brand.logo.color.src },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={fontVariables} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-ink focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
        >
          الانتقال إلى المحتوى الرئيسي
        </a>
        {children}
        {/* Reads the path to show only on the public pages; Suspense keeps pages prerenderable. */}
        <Suspense fallback={null}>
          <SupportWidget />
        </Suspense>
      </body>
    </html>
  );
}
