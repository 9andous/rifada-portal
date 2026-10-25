"use client";

import { Printer } from "lucide-react";
import { Button, type ButtonProps } from "./button";

/** Opens the browser print dialog for the current page (print styles in globals.css). */
export function PrintButton({ children = "طباعة", ...props }: Omit<ButtonProps, "onClick">) {
  return (
    <Button data-print="hide" onClick={() => window.print()} {...props}>
      <Printer strokeWidth={1.75} aria-hidden="true" />
      {children}
    </Button>
  );
}
