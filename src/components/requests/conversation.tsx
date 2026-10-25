"use client";

import { CornerDownLeft, MessagesSquare } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { DateDisplay } from "@/components/ui/date-display";
import { cn } from "@/lib/cn";
import type { CommentView } from "@/server/services/requests/read";
import { CommentComposer } from "./comment-composer";
import { FileItem } from "./file-list";

export const INTERNAL_LABEL = "ملاحظة داخلية — للفريق فقط";

/**
 * The request conversation as a flat thread (no bubbles): author, role, time and text, newest last.
 * Internal notes carry a gold side rule and the internal label (change 16). Officers never receive
 * internal notes from the server; this component only renders what it is given.
 */
export function Conversation({
  requestId,
  comments,
  canComment,
  canWriteInternal,
  canAttach,
  accept,
  maxMb,
}: {
  requestId: string;
  comments: CommentView[];
  canComment: boolean;
  canWriteInternal: boolean;
  canAttach: boolean;
  accept: string;
  maxMb: number;
}) {
  const [replyTo, setReplyTo] = useState<{ id: string; author: string; internal: boolean } | null>(null);
  return (
    <div className="flex flex-col gap-6">
      {comments.length === 0 ? (
        <p className="t-body flex items-center gap-2 text-sm">
          <MessagesSquare aria-hidden="true" strokeWidth={1.75} className="size-4 text-ink-subtle" />
          لا توجد تعليقات بعد.
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {comments.map((c) => (
            <li key={c.id} className={cn("flex gap-3", c.isInternal && "border-s-2 border-accent ps-4")}>
              <Avatar name={c.author.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-bold text-ink">{c.author.name}</span>
                  <span className="t-caption">{c.author.role}</span>
                  {c.isInternal ? <span className="text-xs font-semibold text-accent-ink">{INTERNAL_LABEL}</span> : null}
                  {c.isReply ? <span className="t-caption">· رد</span> : null}
                </div>
                <p className="t-body mt-1 whitespace-pre-line text-sm text-ink">{c.body}</p>
                {c.files.length ? (
                  <ul className="mt-1 flex flex-col">
                    {c.files.map((f) => (
                      <FileItem key={f.attachmentId} requestId={requestId} file={f} />
                    ))}
                  </ul>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <DateDisplay date={c.createdAt} withTime className="t-caption" />
                  {canComment ? (
                    <button
                      type="button"
                      onClick={() => setReplyTo({ id: c.id, author: c.author.name, internal: c.isInternal })}
                      className="t-caption inline-flex items-center gap-1 hover:text-ink"
                    >
                      <CornerDownLeft aria-hidden="true" strokeWidth={1.75} className="size-3.5" />
                      رد
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      {canComment ? (
        <CommentComposer
          requestId={requestId}
          canWriteInternal={canWriteInternal}
          canAttach={canAttach}
          accept={accept}
          maxMb={maxMb}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
        />
      ) : null}
    </div>
  );
}
