# Templates d'email Supabase Auth

L'application se connecte par **code à 6 chiffres** (`signInWithOtp` puis
`verifyOtp({ type: "email" })`, cf. `src/app/login/page.tsx`).

Point important : **Supabase envoie toujours le même jeton**, quelle que soit la
méthode. Ce qui décide si le parent reçoit un *lien* ou un *code*, c'est
uniquement le contenu du template. Les templates par défaut n'exposent que
`{{ .ConfirmationURL }}` — d'où le lien magique reçu tant qu'on ne les corrige pas.
Aucun changement de code applicatif ne peut compenser ça.

## Où coller ces fichiers

Dashboard Supabase → **Authentication › Emails** (onglet *Templates*).

| Fichier | Template à remplacer | Envoyé quand |
| --- | --- | --- |
| `confirm-signup.html` | **Confirm signup** | l'adresse **n'existe pas encore** → première connexion d'un parent |
| `magic-link.html` | **Magic Link** | l'adresse **existe déjà** → parent de retour |

⚠️ **Les deux sont nécessaires.** `signInWithOtp` crée le compte à la volée
(`shouldCreateUser` vaut `true` par défaut) : ne corriger que *Magic Link*
laisserait tous les nouveaux inscrits — donc tous les parents venant de la
landing — recevoir un lien.

Pensez aussi à mettre l'objet de l'email en cohérence, par exemple
« Votre code de connexion Petite Cuillère ».

## Réglages associés

Dans **Authentication › Sign In / Providers › Email** :

- *Email OTP Length* — doit valoir **6** (l'input du formulaire vérifie
  automatiquement dès la 6ᵉ frappe).
- *Email OTP Expiration* — 3600 s par défaut ; le texte des emails annonce
  « une heure », à réaligner si vous changez la valeur.

## Le domaine est en dur

Les deux templates pointent vers `https://petite-cuillere.fr` (nom de marque en
en-tête, domaine en pied d'email). Ils vivent dans le dashboard Supabase, hors
du build Next.js : `NEXT_PUBLIC_SITE_URL` ne les atteint pas. **En cas de
changement de domaine, ces fichiers sont à modifier puis à recoller à la main**
(cf. `docs/deploiement.md`).

À ne pas confondre avec `{{ .ConfirmationURL }}`, qui est construit par Supabase
à partir de la *Site URL* et suit donc automatiquement.

## Ce que font ces templates

Le code est l'élément principal ; le lien reste proposé en bas de l'email pour
qui préfère cliquer (le parcours `/auth/callback` continue de fonctionner). Mise
en page en tableaux et styles inline — la seule chose qui tienne dans les clients
mail —, sans image distante, avec les couleurs du design system converties en
hexadécimal car `oklch()` n'y est pas supporté.
