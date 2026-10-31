"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// Pages that keep the browser's own scroll handling (owner's request, D-112).
const KEEP_SCROLL = ["/admin/associations/new"];

/**
 * Opens every newly visited page at its top (D-112). Next.js only scrolls the changed segment into
 * view, which leaves it under the sticky header. Keyed on the path, so tab, sort and filter links
 * (query only, `scroll={false}`) keep their place; back and forward keep the restored position.
 */
export function ScrollToTop() {
  const pathname = usePathname();
  const first = useRef(true);
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (popped.current) {
      popped.current = false;
      return;
    }
    if (KEEP_SCROLL.includes(pathname) || window.location.hash) return;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
