import { NextRequest } from "next/server";
import { currentUser } from "@/lib/auth/current";
import { getUnseenOrders } from "@/lib/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const POLL_MS = 4_000;
// Le flux se ferme avant la limite de duree d'une fonction ; le navigateur
// (EventSource) se reconnecte seul, ce qui re-verifie aussi la session.
const STREAM_MS = 240_000;

/**
 * Flux Server-Sent Events des nouvelles commandes, pour l'administration.
 * Contrairement a un setInterval, un flux SSE continue d'arriver quand
 * l'onglet est en arriere-plan : l'admin est prevenu meme ailleurs.
 */
export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = request.signal.aborted;
      request.signal.addEventListener("abort", () => {
        closed = true;
      });
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };

      send("retry: 3000\n\n");
      const startedAt = Date.now();
      let lastPayload = "";

      while (!closed && Date.now() - startedAt < STREAM_MS) {
        try {
          const payload = JSON.stringify(await getUnseenOrders());
          if (payload !== lastPayload) {
            send(`event: commandes\ndata: ${payload}\n\n`);
            lastPayload = payload;
          } else {
            send(": ping\n\n");
          }
        } catch (error) {
          console.error("[admin:flux]", error);
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      }

      try {
        controller.close();
      } catch {
        // deja ferme par le client
      }
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
