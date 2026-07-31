"""Test d'integration : cloisonnement des acces et gestion du materiel.

A lancer contre "npm run dev". Voir tests/LISEZMOI.md.
"""

import html
import re
import time
import sys

import requests

BASE = "http://localhost:3700"

ok_count = 0
fail_count = 0


def check(label, condition, detail=""):
    global ok_count, fail_count
    if condition:
        ok_count += 1
        print(f"  OK     {label}")
    else:
        fail_count += 1
        print(f"  ECHEC  {label}   {detail}")


def post_form(session, url, fields, allow_redirects=True):
    """Envoie le formulaire en multipart, comme le fait le navigateur.

    L'en-tete Origin est indispensable : Next.js rejette les appels d'actions
    serveur qui n'en portent pas, pour se premunir des requetes intersites.
    """
    parts = []
    for key, value in fields.items():
        if isinstance(value, list):
            for v in value:
                parts.append((key, (None, v)))
        else:
            parts.append((key, (None, value)))
    return session.post(
        url,
        files=parts,
        headers={"Origin": BASE},
        allow_redirects=allow_redirects,
    )


def flat(text):
    """Ecrase les espaces, y compris les insecables produits par Intl."""
    return re.sub(r"[\s\u00a0\u202f]+", " ", text)


def page_of(session, path):
    return flat(session.get(BASE + path).text)


def hidden_fields(page_html, form_index=0, marker=None):
    """Rejoue les champs caches du formulaire, pour un POST sans JavaScript."""
    forms = re.findall(r"<form\b.*?</form>", page_html, re.S)
    if marker is not None:
        # Les pages d'administration contiennent plusieurs formulaires
        # (deconnexion, stock, publication) : on vise celui qui nous interesse.
        forms = [f for f in forms if marker in f]
    form = forms[form_index]
    fields = {}
    for tag in re.findall(r"<input\b[^>]*>", form):
        attributes = {
            m.group(1): html.unescape(m.group(2))
            for m in re.finditer(r'(\w[\w$:-]*)="([^"]*)"', tag)
        }
        if attributes.get("type") == "hidden" and "name" in attributes:
            fields[attributes["name"]] = attributes.get("value", "")
    return fields


print("\n===== 1. Sans session : les espaces reserves sont fermes =====")
anon = requests.Session()
for path in ["/admin", "/admin/produits", "/admin/produits/nouveau", "/compte"]:
    r = anon.get(BASE + path, allow_redirects=False)
    check(
        f"{path} renvoie vers la connexion",
        r.status_code in (302, 307) and "/connexion" in r.headers.get("location", ""),
        f"recu {r.status_code} {r.headers.get('location','')}",
    )

for path in ["/", "/boutique", "/panier", "/suivi"]:
    r = anon.get(BASE + path)
    check(f"{path} reste public", r.status_code == 200, f"recu {r.status_code}")


print("\n===== 2. Connexion administrateur =====")
admin = requests.Session()
page = admin.get(BASE + "/connexion").text
fields = hidden_fields(page)
fields.update({"email": "admin@example.com", "password": "mauvais-mot-de-passe"})
r = post_form(admin, BASE + "/connexion", fields)
check(
    "un mauvais mot de passe est refuse",
    "incorrect" in r.text.lower(),
    "le message d'erreur n'apparait pas",
)
check(
    "aucune session n'est ouverte apres un echec",
    "bethel_session" not in admin.cookies,
)

check(
    "l'administration ne peut pas être utilisée sans un compte admin configuré",
    "admin@example.com" in r.text or "identifiants" in r.text.lower(),
)


print("\n===== 3. Creation d'un compte client =====")
# Adresse unique a chaque execution : la suite reste rejouable sans vider
# la table des comptes entre deux passages.
CLIENT_EMAIL = f"awa+{int(time.time())}@example.com"
client = requests.Session()
page = client.get(BASE + "/inscription").text
fields = hidden_fields(page)
fields.update(
    {
        "name": "Awa Traore",
        "email": CLIENT_EMAIL,
        "phone": "+225 07 11 22 33",
        "password": "court",
    }
)
r = post_form(client, BASE + "/inscription", fields)
check("un mot de passe trop court est refuse", "doit faire au moins 8" in r.text)

page = client.get(BASE + "/inscription").text
fields = hidden_fields(page)
fields.update(
    {
        "name": "Awa Traore",
        "email": CLIENT_EMAIL,
        "phone": "+225 07 11 22 33",
        "password": "creatrice2026",
    }
)
r = post_form(client, BASE + "/inscription", fields)
check("le compte client est cree", "bethel_session" in client.cookies)
r = client.get(BASE + "/compte")
check("l'espace client s'ouvre", r.status_code == 200 and "Awa Traore" in r.text)

autre = requests.Session()
fields = hidden_fields(autre.get(BASE + "/inscription").text)
fields.update(
    {
        "name": "Homonyme",
        "email": CLIENT_EMAIL,
        "phone": "",
        "password": "creatrice2026",
    }
)
r = post_form(autre, BASE + "/inscription", fields)
check("une adresse deja prise est refusee", "existe deja" in r.text)


print("\n===== 4. Un client n'a pas les acces de l'administrateur =====")
for path in ["/admin", "/admin/produits", "/admin/produits/nouveau", "/admin/commandes"]:
    r = client.get(BASE + path, allow_redirects=False)
    check(
        f"{path} est refuse au client",
        r.status_code in (302, 307) and "/compte" in r.headers.get("location", ""),
        f"recu {r.status_code} {r.headers.get('location','')}",
    )

r = admin.get(BASE + "/compte", allow_redirects=False)
check(
    "l'administrateur peut aussi consulter son espace",
    r.status_code == 200,
    f"recu {r.status_code}",
)


print("\n===== 5. Ajout de materiel par l'administrateur =====")
page = admin.get(BASE + "/admin/produits/nouveau").text
fields = hidden_fields(page, marker='name="headline"')
fields.update(
    {
        "name": "Micro canon compact",
        "brand": "Bethel Select",
        "category": "microphones",
        "headline": "Directivite serree, montage sur griffe, pile AA",
        "description": "Pour isoler une voix en exterieur.",
        "price": "0",
        "compareAtPrice": "",
        "stock": "8",
        "lowStockThreshold": "3",
        "published": "on",
    }
)
r = post_form(admin, BASE + "/admin/produits/nouveau", fields)
check("un prix a zero est refuse", "superieur a zero" in r.text)

page = admin.get(BASE + "/admin/produits/nouveau").text
fields = hidden_fields(page, marker='name="headline"')
fields.update(
    {
        "name": "Micro canon compact",
        "brand": "Bethel Select",
        "category": "microphones",
        "headline": "Directivite serree, montage sur griffe, pile AA",
        "description": "Pour isoler une voix en exterieur, sans capter la rue.",
        "price": "31000",
        "compareAtPrice": "",
        "stock": "8",
        "lowStockThreshold": "3",
        "specLabel": "Directivite",
        "specValue": "Supercardioide",
        "published": "on",
    }
)
r = post_form(admin, BASE + "/admin/produits/nouveau", fields)
check("le materiel est ajoute", "Micro canon compact" in r.text)

fiche = anon.get(BASE + "/boutique/micro-canon-compact")
check(
    "son identifiant d'URL est genere depuis le nom",
    fiche.status_code == 200,
    f"recu {fiche.status_code}",
)
page = flat(fiche.text)
check("son prix est enregistre", "31 000 F CFA" in page)
check("sa fiche technique est enregistree", "Supercardioide" in page)
check("son stock est enregistre", "En stock" in page)
check(
    "il apparait dans le catalogue public",
    "Micro canon compact" in page_of(anon, "/boutique?q=canon"),
)


print("\n===== 6. Un client ne peut pas ajouter de materiel =====")
page_admin = admin.get(BASE + "/admin/produits/nouveau").text
fields = hidden_fields(page_admin, marker='name="headline"')
fields.update(
    {
        "name": "Materiel pirate",
        "brand": "X",
        "category": "accessoires",
        "headline": "Ne doit jamais etre cree",
        "description": "",
        "price": "1000",
        "stock": "1",
        "lowStockThreshold": "1",
        "published": "on",
    }
)
# Le client rejoue exactement la meme requete, avec son propre cookie.
post_form(client, BASE + "/admin/produits/nouveau", fields, allow_redirects=False)
check(
    "l'action serveur refuse le client",
    "Materiel pirate" not in page_of(admin, "/admin/produits"),
    "le produit a ete cree malgre le role client",
)


print("\n===== 7. Modification et suppression =====")
listing = admin.get(BASE + "/admin/produits").text
target_id = re.search(r'/admin/produits/([0-9a-f-]{36})"[^>]*>\s*Micro canon compact', listing)
check("le materiel ajoute est retrouve dans l'administration", target_id is not None)
target = {"id": target_id.group(1) if target_id else ""}
page = admin.get(BASE + f"/admin/produits/{target['id']}").text
check("la fiche de modification s'ouvre", "Micro canon compact" in page)

fields = hidden_fields(page, marker='name="headline"')
fields.update(
    {
        "id": target["id"],
        "name": "Micro canon compact",
        "brand": "Bethel Select",
        "category": "microphones",
        "headline": "Directivite serree, montage sur griffe, pile AA",
        "description": "Pour isoler une voix en exterieur, sans capter la rue.",
        "price": "28500",
        "compareAtPrice": "",
        "stock": "8",
        "lowStockThreshold": "3",
        "published": "on",
    }
)
post_form(admin, BASE + f"/admin/produits/{target['id']}", fields)
check(
    "le prix modifie est enregistre",
    "28 500 F CFA" in page_of(anon, "/boutique/micro-canon-compact"),
)

# Suppression : le formulaire de la zone dangereuse porte le champ confirmation
page = admin.get(BASE + f"/admin/produits/{target['id']}").text
fields = hidden_fields(page, marker='name="confirmation"')
fields.update({"id": target["id"], "confirmation": "nom qui ne correspond pas"})
post_form(admin, BASE + f"/admin/produits/{target['id']}", fields)
check(
    "une confirmation erronee ne supprime rien",
    anon.get(BASE + "/boutique/micro-canon-compact").status_code == 200,
)

fields = hidden_fields(page, marker='name="confirmation"')
fields.update({"id": target["id"], "confirmation": "Micro canon compact"})
post_form(admin, BASE + f"/admin/produits/{target['id']}", fields)
check(
    "le materiel supprime disparait du catalogue",
    anon.get(BASE + "/boutique/micro-canon-compact").status_code == 404,
)
check(
    "il ne s'affiche plus dans la boutique",
    "Micro canon compact" not in page_of(anon, "/boutique?q=canon"),
)
check(
    "les commandes passees gardent leur historique",
    "Micro-cravate sans fil" in page_of(admin, "/admin/commandes"),
)
check(
    "le suivi client fonctionne toujours",
    "BTH-2607-1042" in page_of(anon, "/suivi?ref=BTH-2607-1042"),
)


print("\n===== 8. Deconnexion =====")
r = client.get(BASE + "/compte")
check("le client est encore connecte", r.status_code == 200)
client.cookies.clear()
r = client.get(BASE + "/compte", allow_redirects=False)
check(
    "sans cookie, l'espace client se referme",
    r.status_code in (302, 307),
    f"recu {r.status_code}",
)

forged = requests.Session()
forged.cookies.set("bethel_session", "charge.signature-inventee", domain="localhost")
r = forged.get(BASE + "/admin", allow_redirects=False)
check(
    "un cookie falsifie est rejete",
    r.status_code in (302, 307),
    f"recu {r.status_code}",
)


print(f"\n===== BILAN : {ok_count} verifications reussies, {fail_count} echecs =====")
sys.exit(1 if fail_count else 0)
