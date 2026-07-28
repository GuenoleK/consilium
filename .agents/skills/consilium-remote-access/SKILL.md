---
name: consilium-remote-access
description: Ouvrir, inspecter et fermer l’accès distant temporaire de Consilium avec le gateway authentifié et Cloudflare Tunnel, tout en conservant VS Code comme propriétaire visible des processus. Utiliser quand l’utilisateur demande un accès extérieur, une URL TryCloudflare, le statut ou l’arrêt du tunnel, ou lorsqu’une tâche Consilium/VS Code déjà active doit être préservée ou arrêtée proprement.
---

# Accès distant Consilium

Garder chaque processus dans une tâche VS Code visible. Ne jamais utiliser
`Start-Process`, un terminal caché ou un processus détaché.

## Prévol obligatoire

Depuis la racine du dépôt :

1. Inspecter les ports `5173`, `4337` et `8484`, puis leurs arbres de processus.
2. Tester `http://127.0.0.1:5173` et `/api/health`.
3. Interroger `/api/tasks?activeOnly=true` et `/api/agents`.
4. Vérifier `cloudflared` et le fichier
   `C:\tmp\consilium-remote\password.txt` sans jamais afficher le mot de passe.
5. Rechercher un tunnel déjà actif avant d’en créer un autre.

Ne pas redémarrer une instance saine. Une tâche métier active, un agent en
écoute ou un travail en cours n’empêche pas d’ajouter le tunnel : réutiliser
l’API et le frontend existants.

## Ouvrir l’accès

1. Si `5173` et `4337` ne répondent pas, lancer la tâche VS Code
   **Consilium: Start** et attendre les deux réponses HTTP.
2. Lancer la tâche VS Code **Consilium: Remote Access**.
3. Attendre que le gateway écoute sur `127.0.0.1:8484`.
4. Extraire l’unique URL `https://*.trycloudflare.com` du terminal.
5. Tester que l’URL demande une authentification HTTP 401 sans identifiants.
6. Indiquer l’URL, l’utilisateur `consilium` et l’emplacement local du secret,
   jamais la valeur du secret.

Si le contrôle de VS Code est disponible, utiliser `Terminal > Run Task`.
Sinon, demander à l’utilisateur de lancer la tâche ; ne pas remplacer cette
étape par un lancement caché.

## Fermer proprement

Arrêter dans cet ordre :

1. tâche VS Code **Consilium: Remote Access** ;
2. vérifier la disparition de `cloudflared` et du port `8484` ;
3. conserver **Consilium: Start** si l’utilisateur veut continuer en local.

Pour arrêter aussi Consilium :

1. relire les tâches métier actives et les agents ;
2. signaler précisément ce qui sera interrompu ;
3. obtenir une autorisation explicite si une tâche ou un agent est actif ;
4. terminer **Consilium: Start** depuis VS Code ;
5. vérifier que `5173` et `4337` sont libérés.

Préférer `Terminal > Terminate Task`. N’utiliser `Stop-Process` qu’en secours,
après résolution exacte des PID et autorisation explicite. Ne jamais tuer
Claude, Codex, VS Code ou un serveur MCP avec l’application.

## Conflits et tâches déjà en cours

- Tâche VS Code déjà saine : la réutiliser.
- Tunnel déjà sain : retourner son URL, ne pas en créer un second.
- Processus sans propriétaire ou port incohérent : arrêter uniquement son
  arbre après vérification et autorisation.
- Tâche métier Consilium active : ne jamais la supprimer. Un arrêt du serveur
  conserve son enregistrement, mais interrompt le worker ; prévenir avant.
- Échec de démarrage : arrêter d’abord la tâche distante partiellement lancée,
  vérifier les ports, puis retenter une seule fois.

## Validation finale

Pour un démarrage, confirmer les propriétaires visibles, les ports, le 401 du
gateway et l’URL distante. Pour un arrêt, confirmer l’absence du tunnel et
indiquer si l’application locale reste disponible.
