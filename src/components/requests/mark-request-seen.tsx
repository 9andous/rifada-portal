"use client";

import { useEffect } from "react";
import { markRequestSeenAction } from "@/server/actions/notifications";

/** Opening a request marks its notifications read, once per request (D-111). Renders nothing. */
export function MarkRequestSeen({ requestId }: { requestId: string }) {
  useEffect(() => {
    void markRequestSeenAction(requestId);
  }, [requestId]);
  return null;
}
