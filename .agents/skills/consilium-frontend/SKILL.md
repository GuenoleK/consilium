---
name: consilium-frontend
description: Construire, modifier ou refactorer l’interface web de Consilium. Utiliser pour tout travail React, TypeScript, SCSS, composant, écran, interaction ou thème dans packages/web.
---

# Frontend Consilium

Respecter l’architecture existante et conserver une interface claire, chaleureuse, moderne et accessible.

## Organisation

- Utiliser React avec TypeScript et Vite. Ne pas introduire Webpack ni Tailwind.
- Placer les fonctionnalités dans `src/features/<feature>` et les éléments réutilisables dans `src/shared/components`.
- Donner à chaque composant son dossier, son fichier `.tsx` et son fichier `.scss`.
- Découper un composant principal en sous-composants nommés quand une section possède sa propre responsabilité ou son propre état.
- Employer les structures `List` puis `Item` pour les collections. Garder l’item dans le dossier du composant parent s’il n’est pas réutilisé.
- Éviter à la fois les composants monolithiques et les abstractions sans réutilisation concrète.

## Styles

- Écrire du SCSS local explicitement importé par le composant.
- Utiliser BEM avec une classe racine débogable sur chaque composant.
- Réutiliser les propriétés CSS de `shared/styles/tokens.scss` pour couleurs, fontes, rayons, ombres et thèmes.
- Employer Material Symbols Rounded via le composant `Icon`.
- Préserver le responsive, les états clavier, les libellés accessibles et les contrastes.

## Mise en œuvre

1. Lire le composant principal, ses sous-composants directs et leurs SCSS avant de modifier une fonctionnalité.
2. Réutiliser un composant partagé seulement si son API reste petite et s’il sert plusieurs contextes.
3. Garder les appels réseau dans `src/core`.
4. Maintenir les variables dans `.env.example`; préfixer celles exposées au navigateur par `VITE_`.
5. Exécuter le typecheck et le build après une modification.
