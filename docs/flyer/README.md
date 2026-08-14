# Le flyer

Un tract A5 recto/verso, à distribuer à la sortie des crèches, des écoles
maternelles et des maternités. Il vise un parent pressé, à bout de bras : le
recto se lit en deux secondes et porte le code QR, le verso se lit posé, à la
maison.

| Fichier                   | Format                 | Pour qui                                            |
| ------------------------- | ---------------------- | --------------------------------------------------- |
| `flyer-a5.pdf`            | A5 rogné, 148 × 210 mm | Une imprimante de bureau, un test rapide            |
| `flyer-a5-impression.pdf` | 154 × 216 mm           | L'imprimeur : 3 mm de fond perdu et traits de coupe |
| `flyer.html`              | la source              | C'est ici qu'on modifie le texte                    |

## Imprimer

**Chez soi** : `flyer-a5.pdf`, en recto/verso, bord court, « taille réelle »
(surtout pas « ajuster à la page », qui rétrécit tout de quelques millimètres).
Sur du A4, imprimer deux exemplaires par feuille et couper au milieu.

**Chez un imprimeur** : `flyer-a5-impression.pdf`. Ce qu'il faut lui dire :

- A5 rogné, recto/verso, **fonds perdus de 3 mm** déjà inclus, traits de coupe
  dans la marge de débord ;
- papier mat de 250 à 300 g : le tract passe une journée dans une poche ;
- les aplats verts descendent jusqu'au bord, d'où les fonds perdus. Sans eux, un
  millimètre de dérive à la coupe laisse un liseré blanc.

Un contrôle avant impression peut signaler que le fond perdu n'est pas couvert
sur les deux derniers dixièmes de millimètre du bord droit : Chromium arrondit
la boîte du papier un cheveu plus large que les 154 mm demandés, et cette bande
de 0,17 mm tombe à 2,8 mm **en dehors** du trait de coupe. Elle part à la
rognure, aucun massicot ne dérive de trois millimètres. On peut passer outre.

Les couleurs sont écrites en hexadécimal sRGB. Un imprimeur qui travaille en
CMJN les convertira : le vert « petit pois » et l'abricot perdent alors un peu
d'éclat, ce qui est normal et sans conséquence sur la lisibilité, tous les
contrastes texte/fond étant tenus bien au-delà du minimum.

## Le code QR

Il pointe vers **`petite-cuillere.fr/decouvrir?utm_source=flyer`**, et non vers
la page d'accueil : `/decouvrir` montre le programme **sans créer de compte**,
c'est l'argument le plus fort du produit. Le paramètre `utm_source` permet de
mesurer ce que le papier rapporte.

Il est corrigé au niveau Q (25 % de redondance) : un tract se plie et traîne au
fond d'une poche avant d'être scanné. Le même code figure au dos, un tract se
pose aussi souvent face cachée.

Pour changer la destination, régénérer `assets/qr-decouvrir.svg` :

```bash
npx qrcode -t svg -e Q -o docs/flyer/assets/qr-decouvrir.svg "https://…"
```

## Modifier le texte

Tout est dans `flyer.html`, qui s'ouvre directement dans un navigateur. Après
modification :

```bash
npm run flyer:pdf
```

Les deux PDF sont régénérés par Chromium (déjà présent, aucune dépendance
ajoutée au projet). Si la commande ne trouve pas le navigateur, lui indiquer :
`CHROME_PATH=/chemin/vers/chrome npm run flyer:pdf`.

Deux garde-fous à vérifier après coup, la page ne prévenant pas toute seule :

- **rien ne doit dépasser.** Chaque page fait exactement 210 mm ; du texte
  ajouté déborde en silence et se fait rogner. Les repères sont la marge basse
  du verso (11 mm, comme les autres) et le bandeau vert du recto, qui doit
  toucher le bord ;
- **l'orthographe française.** Espace insécable avant `:` et `!`, à l'intérieur
  des guillemets `«` `»`, et apostrophe typographique `'`. Ce sont les
  caractères eux-mêmes qui sont écrits dans le fichier, jamais `&nbsp;` ni
  `&apos;`.

## Les polices

`assets/` contient les deux polices de la marque, sous
[licence SIL Open Font](https://openfontlicense.org) : **Figtree** (400, 600,
700, 800) et **Bricolage Grotesque** (700, 800). Elles sont embarquées dans le
PDF, condition pour que l'imprimeur voie exactement la même chose que nous.

Ce sont des **instances statiques**, découpées sur le seul sous-ensemble
`latin` — qui porte déjà tous les accents du français et le `œ`. Ce n'est pas un
détail : Chromium ne sait pas embarquer une police variable dans un PDF, il la
remplace alors par des tracés Type3 que les contrôles avant impression
signalent. Les instances ont été produites avec `fonttools varLib.instancer` à
partir des polices variables de Google Fonts, l'axe optique de Bricolage étant
fixé selon l'usage réel de chaque graisse : 12 pt pour le 700, qui porte les
petits titres, 32 pt pour le 800, qui porte les grands.

Seuls les emojis restent en Type3 : Chromium dessine ainsi toute police
couleur. Ils sont décoratifs, chaque aliment étant nommé en toutes lettres
dessous.
