import { userFromRequest } from "@/server/auth/session";
import { subscribeUser, type SignalKind } from "@/server/realtime";
import { bellView } from "@/server/services/notifications";

// Live notifications for the signed-in user as Server-Sent Events (D-111): a snapshot on connect,
// then an update after each change to their notifications. One shared database listener serves
// every stream (src/server/realtime.ts); bursts are coalesced, and a heartbeat keeps proxies open.

const HEARTBEAT_MS = 25_000;
const COALESCE_MS = 300;

export async function GET(request: Request) {
  const session = await userFromRequest(request);
  if (!session) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;
  const encoder = new TextEncoder();

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let pendingNew = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      const push = async (fresh: boolean) => {
        if (closed) return;
        try {
          send("update", { ...(await bellView(userId)), fresh });
        } catch {
          // A failed read is skipped; the next signal or reconnect brings the bell up to date.
        }
      };

      const unsubscribe = subscribeUser(userId, (kind: SignalKind) => {
        if (kind === "new") pendingNew = true;
        if (timer) return;
        timer = setTimeout(() => {
          timer = null;
          const fresh = pendingNew;
          pendingNew = false;
          void push(fresh);
        }, COALESCE_MS);
      });
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        clearInterval(heartbeat);
        if (timer) clearTimeout(timer);
        try {
          controller.close();
        } catch {
          // Already closed by the client.
        }
      };
      request.signal.addEventListener("abort", () => cleanup());

      // The browser waits 15 s before reconnecting after a drop, so a failing server is not hammered.
      controller.enqueue(encoder.encode("retry: 15000\n\n"));
      await push(false);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
