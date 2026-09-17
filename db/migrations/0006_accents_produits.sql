-- 0006 · Accents des fiches produit de demonstration.
--
-- Les produits crees a partir du catalogue de demonstration ont ete saisis
-- sans accents. Chaque champ n'est corrige que s'il porte encore exactement
-- le texte d'origine : un nom, une description ou une caracteristique
-- modifie depuis l'administration n'est jamais touche.

UPDATE products SET name = 'Trépied téléphone 160 cm', updated_at = now()
WHERE id = 'p-001' AND name = 'Trepied telephone 160 cm';
UPDATE products SET headline = 'Aluminium, rotule 3 axes, télécommande Bluetooth incluse', updated_at = now()
WHERE id = 'p-001' AND headline = 'Aluminium, rotule 3 axes, telecommande Bluetooth incluse';
UPDATE products SET description = 'Le trépied à tout faire : assez haut pour filmer debout, assez léger pour tenir dans un sac. La rotule se bloque sur trois axes, le support téléphone s''ouvre jusqu''à 9 cm et la télécommande Bluetooth déclenche à distance. Livré avec sa housse.', updated_at = now()
WHERE id = 'p-001' AND description = 'Le trepied a tout faire : assez haut pour filmer debout, assez leger pour tenir dans un sac. La rotule se bloque sur trois axes, le support telephone s''ouvre jusqu''a 9 cm et la telecommande Bluetooth declenche a distance. Livre avec sa housse.';
UPDATE product_specs SET label = 'Hauteur repliée' WHERE product_id = 'p-001' AND label = 'Hauteur repliee';
UPDATE product_specs SET label = 'Livré avec' WHERE product_id = 'p-001' AND label = 'Livre avec';
UPDATE product_specs SET value = 'Housse, télécommande BT' WHERE product_id = 'p-001' AND value = 'Housse, telecommande BT';

UPDATE products SET name = 'Trépied de table flexible', updated_at = now()
WHERE id = 'p-002' AND name = 'Trepied de table flexible';
UPDATE products SET headline = 'Bras articulés, s''accroche partout, tient un reflex léger', updated_at = now()
WHERE id = 'p-002' AND headline = 'Bras articules, s''accroche partout, tient un reflex leger';
UPDATE products SET description = 'Pour filmer au bureau, en voiture ou accroché à une branche. Les bras articulés gardent leur position et les pieds antidérapants tiennent sur le verre. Support téléphone et vis appareil photo fournis.', updated_at = now()
WHERE id = 'p-002' AND description = 'Pour filmer au bureau, en voiture ou accroche a une branche. Les bras articules gardent leur position et les pieds antiderapants tiennent sur le verre. Support telephone et vis appareil photo fournis.';

UPDATE products SET headline = 'Deux émetteurs, un récepteur, 20 h d''autonomie avec le boîtier', updated_at = now()
WHERE id = 'p-003' AND headline = 'Deux emetteurs, un recepteur, 20 h d''autonomie avec le boitier';
UPDATE products SET description = 'Deux personnes qui parlent, un seul récepteur. L''appairage est automatique à l''ouverture du boîtier, la portée tient 100 m en champ libre et la réduction de bruit se coupe d''un bouton. Adaptateurs USB-C, Lightning et jack 3,5 mm inclus.', updated_at = now()
WHERE id = 'p-003' AND description = 'Deux personnes qui parlent, un seul recepteur. L''appairage est automatique a l''ouverture du boitier, la portee tient 100 m en champ libre et la reduction de bruit se coupe d''un bouton. Adaptateurs USB-C, Lightning et jack 3,5 mm inclus.';
UPDATE product_specs SET label = 'Portée' WHERE product_id = 'p-003' AND label = 'Portee';
UPDATE product_specs SET value = '6 h + 14 h via boîtier' WHERE product_id = 'p-003' AND value = '6 h + 14 h via boitier';
UPDATE product_specs SET label = 'Réduction de bruit' WHERE product_id = 'p-003' AND label = 'Reduction de bruit';
UPDATE product_specs SET label = 'Poids émetteur' WHERE product_id = 'p-003' AND label = 'Poids emetteur';

UPDATE products SET headline = 'Cardioïde, sortie casque zéro latence, pied de bureau fourni', updated_at = now()
WHERE id = 'p-004' AND headline = 'Cardioide, sortie casque zero latence, pied de bureau fourni';
UPDATE products SET description = 'Un micro à brancher pour les podcasts, les voix off et les lives. La prise casque permet de s''entendre sans décalage, le gain et le volume sont sur la face avant. Compatible ordinateur et téléphone.', updated_at = now()
WHERE id = 'p-004' AND description = 'Un micro a brancher pour les podcasts, les voix off et les lives. La prise casque permet de s''entendre sans decalage, le gain et le volume sont sur la face avant. Compatible ordinateur et telephone.';
UPDATE product_specs SET label = 'Directivité' WHERE product_id = 'p-004' AND label = 'Directivite';
UPDATE product_specs SET value = 'Cardioïde' WHERE product_id = 'p-004' AND value = 'Cardioide';
UPDATE product_specs SET label = 'Échantillonnage' WHERE product_id = 'p-004' AND label = 'Echantillonnage';
UPDATE product_specs SET value = 'Jack 3,5 mm, zéro latence' WHERE product_id = 'p-004' AND value = 'Jack 3,5 mm, zero latence';

UPDATE products SET headline = '3200K à 5600K, CRI 96, monture Bowens', updated_at = now()
WHERE id = 'p-005' AND headline = '3200K a 5600K, CRI 96, monture Bowens';
UPDATE products SET description = 'La lumière principale d''un petit studio. La température se règle en continu du tungstène à la lumière du jour, l''indice de rendu des couleurs de 96 garde les peaux justes. Monture Bowens compatible avec les softbox du marché.', updated_at = now()
WHERE id = 'p-005' AND description = 'La lumiere principale d''un petit studio. La temperature se regle en continu du tungstene a la lumiere du jour, l''indice de rendu des couleurs de 96 garde les peaux justes. Monture Bowens compatible avec les softbox du marche.';
UPDATE product_specs SET label = 'Température' WHERE product_id = 'p-005' AND label = 'Temperature';

UPDATE products SET headline = 'Pied 2 m, support téléphone, trois températures', updated_at = now()
WHERE id = 'p-006' AND headline = 'Pied 2 m, support telephone, trois temperatures';
UPDATE products SET description = 'L''éclairage des tutoriels et des lives : une lumière douce, centrée, sans ombre dure. Trois températures et une intensité réglable de 1 à 100 %. Le pied monte à 2 m et le support téléphone pivote en portrait ou paysage.', updated_at = now()
WHERE id = 'p-006' AND description = 'L''eclairage des tutoriels et des lives : une lumiere douce, centree, sans ombre dure. Trois temperatures et une intensite reglable de 1 a 100 %. Le pied monte a 2 m et le support telephone pivote en portrait ou paysage.';
UPDATE product_specs SET label = 'Diamètre' WHERE product_id = 'p-006' AND label = 'Diametre';
UPDATE product_specs SET label = 'Températures' WHERE product_id = 'p-006' AND label = 'Temperatures';
UPDATE product_specs SET value = 'Secteur, câble 3 m' WHERE product_id = 'p-006' AND value = 'Secteur, cable 3 m';

UPDATE products SET description = 'La softbox qui se monte comme un parapluie : on ouvre, on clipse, c''est fini. Double diffusion pour adoucir la lumière et grille nid d''abeille pour la resserrer quand le fond doit rester sombre.', updated_at = now()
WHERE id = 'p-007' AND description = 'La softbox qui se monte comme un parapluie : on ouvre, on clipse, c''est fini. Double diffusion pour adoucir la lumiere et grille nid d''abeille pour la resserrer quand le fond doit rester sombre.';

UPDATE products SET headline = 'Écriture 90 Mo/s, certifiée pour la vidéo 4K', updated_at = now()
WHERE id = 'p-008' AND headline = 'Ecriture 90 Mo/s, certifiee pour la video 4K';
UPDATE products SET description = 'La carte qui ne coupe pas l''enregistrement en pleine prise. Classe V30, adaptée à la 4K sur téléphone, caméra d''action et reflex. Adaptateur SD inclus.', updated_at = now()
WHERE id = 'p-008' AND description = 'La carte qui ne coupe pas l''enregistrement en pleine prise. Classe V30, adaptee a la 4K sur telephone, camera d''action et reflex. Adaptateur SD inclus.';
UPDATE product_specs SET label = 'Capacité' WHERE product_id = 'p-008' AND label = 'Capacite';
UPDATE product_specs SET label = 'Écriture' WHERE product_id = 'p-008' AND label = 'Ecriture';
UPDATE product_specs SET label = 'Livré avec' WHERE product_id = 'p-008' AND label = 'Livre avec';

UPDATE products SET description = 'De quoi tenir une journée de tournage sans prise : trois sorties, charge rapide 65 W en USB-C et affichage du pourcentage restant. Recharge aussi bien un téléphone qu''un panneau LED via adaptateur.', updated_at = now()
WHERE id = 'p-009' AND description = 'De quoi tenir une journee de tournage sans prise : trois sorties, charge rapide 65 W en USB-C et affichage du pourcentage restant. Recharge aussi bien un telephone qu''un panneau LED via adaptateur.';
UPDATE product_specs SET label = 'Capacité' WHERE product_id = 'p-009' AND label = 'Capacite';

UPDATE products SET name = 'Câble XLR 5 m', updated_at = now()
WHERE id = 'p-010' AND name = 'Cable XLR 5 m';
UPDATE products SET headline = 'Blindage double, connecteurs métal, gaine souple', updated_at = now()
WHERE id = 'p-010' AND headline = 'Blindage double, connecteurs metal, gaine souple';
UPDATE products SET description = 'Le câble qu''on garde dix ans. Blindage double contre les parasites, connecteurs métal avec verrouillage et gaine souple qui ne garde pas les plis.', updated_at = now()
WHERE id = 'p-010' AND description = 'Le cable qu''on garde dix ans. Blindage double contre les parasites, connecteurs metal avec verrouillage et gaine souple qui ne garde pas les plis.';
UPDATE product_specs SET value = 'XLR mâle / femelle' WHERE product_id = 'p-010' AND value = 'XLR male / femelle';

UPDATE products SET name = 'Stabilisateur 3 axes téléphone', updated_at = now()
WHERE id = 'p-011' AND name = 'Stabilisateur 3 axes telephone';
UPDATE products SET description = 'Pour marcher en filmant sans que l''image tremble. Trois moteurs compensent les mouvements, le suivi du visage garde le sujet centré et l''ensemble se plie à la taille d''une trousse.', updated_at = now()
WHERE id = 'p-011' AND description = 'Pour marcher en filmant sans que l''image tremble. Trois moteurs compensent les mouvements, le suivi du visage garde le sujet centre et l''ensemble se plie a la taille d''une trousse.';
UPDATE product_specs SET label = 'Axes stabilisés' WHERE product_id = 'p-011' AND label = 'Axes stabilises';

UPDATE products SET headline = 'Atténue le vent sans étouffer les aigus', updated_at = now()
WHERE id = 'p-012' AND headline = 'Attenue le vent sans etouffer les aigus';
UPDATE products SET description = 'La pièce à 5 000 F qui sauve une prise en extérieur. Fourrure longue montée sur une bague élastique, compatible avec la plupart des micros-cravates et micros canon compacts.', updated_at = now()
WHERE id = 'p-012' AND description = 'La piece a 5 000 F qui sauve une prise en exterieur. Fourrure longue montee sur une bague elastique, compatible avec la plupart des micros-cravates et micros canon compacts.';
UPDATE product_specs SET label = 'Compatibilité' WHERE product_id = 'p-012' AND label = 'Compatibilite';
UPDATE product_specs SET label = 'Atténuation' WHERE product_id = 'p-012' AND label = 'Attenuation';
UPDATE product_specs SET value = 'Bague élastique' WHERE product_id = 'p-012' AND value = 'Bague elastique';

UPDATE products SET headline = 'Anamorphique 1.33X plein format, monture PL, look cinéma', updated_at = now()
WHERE id = 'p-013' AND headline = 'Anamorphique 1.33X plein format, monture PL, look cinema';
UPDATE products SET description = 'L''objectif qui donne le flare ovale et le bokeh étiré du cinéma anamorphique, sans sortir du budget d''un tournage indépendant. Monture PL, couverture plein format et bague de mise au point fluide sur toute sa course. Ouverture constante T2.0 pour tourner en lumière naturelle comme en studio.', updated_at = now()
WHERE id = 'p-013' AND description = 'L''objectif qui donne le flare ovale et le bokeh etire du cinema anamorphique, sans sortir du budget d''un tournage independant. Monture PL, couverture plein format et bague de mise au point fluide sur toute sa course. Ouverture constante T2.0 pour tourner en lumiere naturelle comme en studio.';
