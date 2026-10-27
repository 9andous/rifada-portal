"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Link to a home-page section ("/#values"). On the home page it glides to the section instead of
 * letting the router jump there; elsewhere it navigates to the home page as a normal link.
 * Reduced motion keeps the instant jump.
 */
export function SectionLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const pathname = usePathname();

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (pathname !== "/" || !href.includes("#") || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    const hash = href.slice(href.indexOf("#"));
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    window.history.pushState(null, "", hash);
  }

  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}
