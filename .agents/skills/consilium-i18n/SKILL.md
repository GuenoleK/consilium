---
name: consilium-i18n
description: Ajouter, modifier ou supprimer un texte affiché dans l’interface de Consilium (libellé, placeholder, aria-label, title, message d’erreur, confirmation, notification, pluriel, date ou taille formatée). Utiliser dès qu’un texte visible par l’utilisateur est écrit dans packages/web, ou dans la page de connexion du gateway distant, afin de créer les clés en anglais et en français.
---

# Traductions Consilium

L’interface existe en anglais (langue par défaut) et en français. Le choix de l’utilisateur, fait dans les paramètres et conservé dans `localStorage` (`consilium-language`), l’emporte ; en mode « Automatique », la langue est détectée depuis `navigator.languages` (premier choix pris en charge, anglais sinon). Aucun texte visible ne doit être écrit en dur dans un composant.

## Fichiers

- `packages/web/src/i18n/locales/en.ts` : source de vérité, définit la forme du dictionnaire.
- `packages/web/src/i18n/locales/fr.ts` : typé `Translations`. Une clé manquante ou en trop casse le typecheck.
- `packages/web/src/i18n/translate.ts` : détection de langue, type `TranslationKey`, fonction `t`.
- `useTranslation()` (depuis `src/i18n`) renvoie `{ t, locale }`.

## Organisation des clés

Une clé suit la logique BEM du composant : `bloc.élément.modificateur`, en camelCase, le bloc étant le nom du composant (`settingsDialog.header.title` pour `.settings-dialog__header`).

- Un bloc par composant ou partie de l’application : `topicList`, `agentPanel`, `messageComposer`, `settingsDialog`, `taskItem`…
- `common` : textes réellement partagés (`close`, `cancel`, `you`, tailles de fichier, `messageCount`). Ne mutualiser qu’un texte identique dans au moins deux composants ; sinon le garder dans le bloc du composant.
- Énumérations du domaine : `agentStatus.<status>` et `taskStatus.<status>`, appelées avec `t(`agentStatus.${agent.status}`)`. Ajouter une valeur à l’enum dans `@consilium/core` impose d’ajouter la clé (le typecheck le signale).
- Garder les blocs classés comme les composants ; ajouter le nouveau bloc au même endroit dans `en.ts` et `fr.ts`.

## Ajouter un texte

1. Créer la clé dans `en.ts` dans le bloc du composant, puis la même clé au même endroit dans `fr.ts`, dans la même modification.
2. Dans le composant : `const { t } = useTranslation();` puis `t("bloc.element")`. Hors composant (fonction utilitaire, constante de module), passer `t` ou `locale` en paramètre plutôt que de traduire à l’import.
3. Variables : `t("roundTable.attention.mention.title", { name })` avec `{name}` dans le texte. Ne jamais concaténer de morceaux traduits.
4. Pluriels : un nœud `{ one: "…", other: "…" }` appelé avec `{ count }`. Les deux langues doivent avoir les mêmes formes (`one` et `other`) ; `other` sert de repli.
5. Formats : dates, heures et nombres avec `Intl.*` et `locale`, jamais avec `"fr"` en dur. Tailles de fichier via `formatFileSize(size, t, locale)`. Tri alphabétique avec `localeCompare(…, locale)`.
6. Ne pas stocker de texte traduit dans un état quand on peut stocker la cause (un booléen d’erreur, par exemple) et traduire au rendu : le texte suit alors la langue.

## Ce qui ne se traduit pas

- Le contenu échangé avec les modèles et écrit par les utilisateurs : les agents parlent la langue de l’utilisateur.
- Les identifiants de protocole : `@vous`, `@tous`, `@all`, `HUMAN_AUTHOR_NAME`, `HUMAN_MENTION`, `mentionKey`, `agentId`. Afficher l’humain avec `common.you` (hook `useAuthorName`), sans changer la valeur envoyée au serveur.
- Le nom de marque « Consilium », les noms d’icônes Material Symbols, les classes CSS, les clés `localStorage`.
- Les messages d’erreur techniques de l’API et du MCP, qui restent en anglais et ne sont pas affichés tels quels.

## Cas particuliers

- La page de connexion du gateway distant (`packages/server/src/remoteGateway.ts`) est un processus autonome : ses textes vivent dans `loginTexts` (en/fr), choisis via `Accept-Language`. Ajouter toute nouvelle chaîne dans les deux langues.
- `index.html` porte la langue et le titre par défaut (anglais) ; `I18nProvider` les met à jour au chargement.
- Ajouter une langue : créer `locales/<code>.ts` typé `Translations`, l’enregistrer dans `locales` et donner son nom dans sa propre langue à `localeNames` (`translate.ts`), puis l’ajouter à `loginTexts`. Le sélecteur des paramètres la propose alors automatiquement.

## Vérification

1. Exécuter `npm run typecheck` : il garantit que les deux langues ont exactement les mêmes clés.
2. Chercher les textes oubliés : `grep -rnP "[àâçéèêëîïôùû]" packages/web/src --include=*.tsx --include=*.ts` hors `locales/fr.ts`, ainsi que les attributs `aria-label`, `title`, `placeholder` et `alt` à valeur littérale.
3. Pour un changement visible, contrôler l’écran dans les deux langues (régler la langue du navigateur sur `fr` puis `en`).
