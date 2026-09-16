/**
 * Faux Jeko pour les tests de parcours : API partenaire (creation et lecture
 * des demandes de paiement) et page de paiement hebergee.
 *
 * Le site est lance avec JEKO_API_BASE=http://127.0.0.1:<port> (voir
 * playwright.config.ts). La page /pay/<id> joue le role de l'application de
 * l'operateur : "Payer" ou "Annuler", puis retour vers le site, comme Jeko.
 */

import http from "node:http";

const port = Number(process.env.FAKE_JEKO_PORT ?? 3101);
const requests = new Map();
let created = 0;

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/sante") return send(res, 200, { ok: true });

  if (url.pathname.startsWith("/partner_api/payment_requests")) {
    if (!req.headers["x-api-key"] || !req.headers["x-api-key-id"]) return send(res, 401, { message: "clés absentes" });

    if (req.method === "POST") {
      const body = JSON.parse(await readBody(req));
      created += 1;
      const id = `pr-e2e-${created}`;
      requests.set(id, {
        status: "pending",
        amountCents: body.amountCents,
        reference: body.reference,
        successUrl: body.paymentDetails.data.successUrl,
        errorUrl: body.paymentDetails.data.errorUrl,
      });
      return send(res, 201, { id, redirectUrl: `http://127.0.0.1:${port}/pay/${id}` });
    }

    const request = requests.get(decodeURIComponent(parts[2] ?? ""));
    if (!request) return send(res, 404, { message: "inconnue" });
    return send(res, 200, {
      id: parts[2],
      status: request.status,
      transaction: { amount: { amount: request.amountCents } },
    });
  }

  if (parts[0] === "pay") {
    const request = requests.get(parts[1]);
    if (!request) return send(res, 404, "Demande inconnue", "text/plain");

    if (req.method === "POST") {
      const action = new URLSearchParams(await readBody(req)).get("action");
      request.status = action === "payer" ? "success" : "error";
      res.writeHead(303, { Location: action === "payer" ? request.successUrl : request.errorUrl });
      return res.end();
    }

    return send(
      res,
      200,
      `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Faux Jeko</title></head><body>
<h1>Paiement ${request.reference}</h1>
<p>Montant : ${request.amountCents / 100} FCFA</p>
<form method="post"><button name="action" value="payer">Payer</button><button name="action" value="annuler">Annuler</button></form>
</body></html>`,
      "text/html; charset=utf-8"
    );
  }

  send(res, 404, { message: "introuvable" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`faux Jeko sur http://127.0.0.1:${port}`);
});
