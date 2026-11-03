"use client";

import { Fragment, useLayoutEffect, useState, type ReactNode } from "react";

/**
 * Starts its children afresh each time the page is left (owner's review, D-130). With Cache
 * Components a page left behind keeps its state, so «تقديم طلب جديد» reopened the draft created on
 * the last visit; a new key on hiding makes the next visit a new, empty form.
 */
export function FreshOnReturn({ children }: { children: ReactNode }) {
  const [round, setRound] = useState(0);
  useLayoutEffect(() => () => setRound((r) => r + 1), []);
  return <Fragment key={round}>{children}</Fragment>;
}
