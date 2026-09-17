-- 0005 · Accents des categories.
--
-- Les noms et accroches des categories ont ete saisis sans accents a la
-- creation de la base. L'administration ne permet pas de les modifier : ils
-- sont corriges ici, uniquement s'ils ont encore leur texte d'origine.

UPDATE categories SET name = 'Trépieds & stabilisation', tagline = 'Tenir le cadre, du téléphone au reflex'
WHERE slug = 'trepieds' AND name = 'Trepieds & stabilisation' AND tagline = 'Tenir le cadre, du telephone au reflex';

UPDATE categories SET name = 'Éclairage', tagline = 'Panneaux, anneaux et softbox de 3200K à 5600K'
WHERE slug = 'eclairage' AND name = 'Eclairage' AND tagline = 'Panneaux, anneaux et softbox de 3200K a 5600K';

UPDATE categories SET name = 'Objectifs', tagline = 'Lentilles ciné, anamorphiques et optiques fixes pour vos plans'
WHERE slug = 'objectifs' AND name = 'Objectifs' AND tagline = 'Lentilles cine, anamorphiques et optiques fixes pour vos plans';

UPDATE categories SET name = 'Accessoires', tagline = 'Cartes, batteries, câbles et petites pièces qui manquent'
WHERE slug = 'accessoires' AND name = 'Accessoires' AND tagline = 'Cartes, batteries, cables et petites pieces qui manquent';
