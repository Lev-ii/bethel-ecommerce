# Test d'integration

Verifie le cloisonnement des acces et la gestion du materiel : 41 controles.

## Lancer

```bash
npm run db:setup       # base prete
npm run dev            # dans un terminal
pip install requests   # une seule fois
python3 tests/integration.py
```

Le test doit tourner contre `npm run dev`, pas contre `npm start` : en
production le cookie de session porte l'attribut `Secure` et n'est donc pas
renvoye sur `http://localhost`. C'est le comportement attendu.

Le test est rejouable : il cree un compte client avec une adresse unique a
chaque execution et nettoie le materiel qu'il ajoute.

## Ce qui est verifie

1. Sans session, les espaces reserves sont fermes et la boutique reste ouverte
2. Connexion administrateur, mauvais mot de passe refuse sans ouvrir de session
3. Creation d'un compte client, regles de mot de passe
4. Un client n'a pas les acces de l'administrateur
5. Ajout de materiel : validation, enregistrement, publication
6. Un client qui rejoue la requete d'ajout est refuse par l'action serveur
7. Modification, confirmation de suppression, integrite des commandes passees
8. Deconnexion, cookie falsifie rejete

## Test de concurrence

```bash
npm run test:concurrence
```

Lance deux commandes simultanees sur le dernier exemplaire d'un produit et
verifie qu'une seule passe. Verifie aussi les garde-fous poses en base : stock
jamais negatif, prix barre toujours superieur au prix de vente, et prix des
commandes passees jamais reecrit par un changement de tarif.

C'est ce que l'ancien stockage en fichier JSON ne pouvait pas garantir : les
deux commandes lisaient le meme stock avant que l'une ait ecrit, et les deux
passaient.
