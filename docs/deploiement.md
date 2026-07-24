# Déploiement & domaine

> Ce qu'il faut configurer hors du code pour que `petite-cuillere.fr` fonctionne
> en production : Vercel, DNS, Supabase.

Dernière mise à jour : 2026-07-24

---

## Principe : l'application ignore son domaine

Aucune URL n'est écrite en dur dans le code applicatif. Les redirections d'authentification
dérivent de `window.location.origin` (côté client) ou de l'origine de la requête
(`src/app/auth/callback/route.ts`). **Changer de domaine ne demande donc aucune modification
de code** — seulement de la configuration.

Une seule chose ne peut pas être relative : les métadonnées absolues (Open Graph,
canonique, sitemap). Elles sont centralisées dans **`src/lib/site.ts`**, avec
`https://petite-cuillere.fr` comme valeur par défaut et `NEXT_PUBLIC_SITE_URL`
comme surcharge.

---

## 1. Vercel

### Domaines

**Settings › Domains** → ajouter les deux :

| Domaine | Rôle |
| --- | --- |
| `petite-cuillere.fr` | **principal** — c'est lui qui doit servir le site |
| `www.petite-cuillere.fr` | redirection 308 vers le principal |

Vercel provisionne le certificat TLS automatiquement une fois le DNS propagé.

### Variable d'environnement

**Settings › Environment Variables**, portée **Production** :

```
NEXT_PUBLIC_SITE_URL = https://petite-cuillere.fr
```

Techniquement facultative — `src/lib/site.ts` retombe sur cette même valeur — mais
la déclarer évite que le domaine de production ne vive que dans le code source.

⚠️ Une variable d'environnement Next.js est **figée au build**. Après l'avoir
ajoutée, il faut **redéployer** : la modifier ne suffit pas.

---

## 2. DNS (chez le registrar de `petite-cuillere.fr`)

Utilisez **les valeurs exactes affichées par Vercel** dans l'écran Domains : elles
varient selon les projets et Vercel a changé d'adresses au fil du temps. Les formes
attendues :

| Enregistrement | Nom | Valeur |
| --- | --- | --- |
| `A` | `@` (apex) | l'IP indiquée par Vercel (historiquement `76.76.21.21`, `216.198.79.1` sur les projets récents) |
| `CNAME` | `www` | l'hôte indiqué par Vercel (`cname.vercel-dns.com` ou équivalent) |

Si le registrar propose un `ALIAS`/`ANAME` sur l'apex, il est préférable à l'`A` :
il suit les changements d'IP de Vercel sans intervention.

Comptez de quelques minutes à quelques heures de propagation. Vérification :

```sh
dig +short petite-cuillere.fr
dig +short www.petite-cuillere.fr
```

---

## 3. Supabase — l'étape la plus facile à oublier

**Authentication › URL Configuration** :

- **Site URL** → `https://petite-cuillere.fr`
  C'est la base à partir de laquelle est construit le `{{ .ConfirmationURL }}` des
  emails (cf. `supabase/email-templates/`). Laissée sur l'ancien domaine, tout lien
  de secours envoyé aux parents pointe vers le mauvais site.
- **Redirect URLs** → autoriser :

  ```
  https://petite-cuillere.fr/**
  https://www.petite-cuillere.fr/**
  https://*.vercel.app/**
  http://localhost:3000/**
  ```

  Le code passe `emailRedirectTo: ${window.location.origin}/auth/callback`. Une
  origine absente de cette liste est **silencieusement remplacée** par la Site URL —
  panne difficile à diagnostiquer, sans message d'erreur.

⚠️ Les templates de `supabase/email-templates/` contiennent le domaine **en dur**
(lien de retour vers le site). Ils vivent dans le dashboard, hors du build : un
changement de domaine impose de les modifier et de les recoller à la main.

**Nuance utile** : la connexion principale se fait par **code à 6 chiffres**
(`verifyOtp`), qui ne dépend d'aucune URL de redirection. Une erreur ici ne casse
donc que le lien de secours et le parcours d'invitation `/rejoindre/[token]` — pas
la connexion courante.

---

## 4. Vérifications après bascule

- [ ] `https://petite-cuillere.fr` répond en HTTPS, certificat valide
- [ ] `https://www.petite-cuillere.fr` redirige vers l'apex
- [ ] `https://petite-cuillere.fr/robots.txt` — `Sitemap:` pointe sur le bon domaine
- [ ] `https://petite-cuillere.fr/sitemap.xml` — deux URL, bon domaine
- [ ] `https://petite-cuillere.fr/opengraph-image` — l'image s'affiche
- [ ] Le lien collé dans une conversation affiche bien un aperçu
- [ ] Connexion par code à 6 chiffres avec une adresse **jamais utilisée**
      (déclenche le template *Confirm signup*, pas *Magic Link*)
- [ ] Le lien de secours de l'email aboutit sur le nouveau domaine

---

## Référencement

`src/app/robots.ts` et `src/app/sitemap.ts` n'ouvrent à l'indexation que la landing
(`/`) et l'entrée sans compte (`/decouvrir`) ; tout ce qui touche à un foyer est
interdit aux robots.

Les déploiements d'aperçu sont fermés en bloc via `VERCEL_ENV` (`isProductionSite`
dans `src/lib/site.ts`), en `robots.txt` **et** en balise `robots` — sans quoi
chaque branche déployée ferait doublon avec le vrai site dans les moteurs.

---

## Reste à faire avant l'ouverture au public

- **CGU / mentions légales** — la mention « pas un avis médical », retirée de
  l'interface le 2026-07-24, doit y être traitée (cf. `ux-redesign.md` §9.2).
- **RGPD** — données de santé d'un mineur : région d'hébergement, durée de
  conservation, suppression de compte, export (cf. `ux-redesign.md` §9.3).
