import type { Metadata } from "next";
import { Suspense } from "react";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { SupportWidget } from "@/components/layout/support-widget";
import { contrastInitScript } from "@/components/layout/accessibility-menu";
import { textSizeInitScript } from "@/components/layout/text-size";
import { themeInitScript } from "@/components/layout/theme-toggle";
import { Toaster } from "@/components/ui/toaster";
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
        {/* Separate tags: each value is a client module's export, resolved when the page is rendered. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: textSizeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: contrastInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-ink focus:not-sr-only focus:absolute focus:start-4 focus:top-4"
        >
          الانتقال إلى المحتوى الرئيسي
        </a>
        {children}
        <Toaster />
        {/* Reads the path; Suspense keeps pages prerenderable. */}
        <Suspense fallback={null}>
          <ScrollToTop />
        </Suspense>
        {/* Reads the path to show only on the public pages; Suspense keeps pages prerenderable. */}
        <Suspense fallback={null}>
          <SupportWidget />
        </Suspense>
      </body>
    </html>
  );
}
