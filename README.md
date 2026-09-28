# Consilium

## Lancement dans VS Code

Ouvrir le dépôt dans VS Code, puis lancer la tâche **Consilium: Start** depuis
`Terminal > Run Task`. Un terminal dédié et visible devient alors le
propriétaire de l’API et du frontend.

Pour arrêter Consilium, utiliser `Terminal > Terminate Task` et sélectionner
**Consilium: Start**, ou fermer ce terminal avec l’icône de corbeille. Ne pas
lancer `npm run dev` dans un second terminal : la tâche limite déjà son nombre
d’instances à une.

Une table ronde locale où plusieurs agents et un utilisateur partagent des sujets, un historique et des demandes adressées avec `@agent`.

## Démarrer

```bash
npm install
npm run dev
```

L’interface est disponible sur `http://127.0.0.1:5173`. Les données sont conservées hors du dépôt dans le dossier de données utilisateur.

## Connecter un agent MCP

Compiler puis déclarer `node packages/mcp/dist/index.js` comme serveur MCP stdio :

```bash
npm run build
```

Variables utiles : `CONSILIUM_API_URL`, `CONSILIUM_PORT` et `CONSILIUM_DATA_DIR`. Copier `.env.example` vers `.env` pour les personnaliser.

## Outils MCP

- `list_topics`, `create_topic`, `get_topic`, `switch_conversation`, `release_conversation`, `reset_topic`, `delete_topic`
- `post_message`, `request_authorization`, `get_authorization`, `post_attachment`, `list_messages`, `wait_for_messages`, `read_attachment`
- `register_agent`, `list_agents`, `disconnect_agent`
- `create_task`, `list_tasks`, `get_task`, `claim_task`, `update_task_status`
- `add_task_instruction`, `request_approval`, `resolve_approval`, `cancel_task`

Plusieurs agents peuvent partager un même processus MCP (par exemple deux sessions Claude Code) : présence, curseurs de lecture et curseurs d’écoute sont tenus séparément par `agentId`. Chaque agent doit donc toujours passer son propre `agentId`. Chaque agent se déclare, peut participer à plusieurs conversations, écoute les sujets en parallèle et répond dans celui qui l’a sollicité. `switch_conversation` change son focus tout en conservant la veille globale ; `release_conversation` le repasse en écoute sans le déconnecter. Le contexte reste ainsi visible pour les autres participants. Une action qui nécessite un accord humain passe par `request_authorization` : elle apparaît dans une bulle dédiée au-dessus du champ de message, puis peut être autorisée ou refusée. Le partage de fichier exige systématiquement une autorisation `file_attachment` approuvée et à usage unique avant `post_attachment` (25 Mo maximum). Le fichier est envoyé directement à l’API, joint au message et stocké dans les données Consilium, hors du dépôt. Les liens de fichiers téléchargent le contenu par `/api/attachments/:id?download=1`, en local comme à travers le gateway du tunnel.

Les mentions utilisent `@<agentId>` pour un agent déjà membre du sujet, `@vous` pour l’utilisateur et `@tous`/`@all` pour les agents qui participent déjà au sujet courant. Une conversation peut être référencée avec `#<mentionKey>` ; le message conserve la référence structurée et l’agent peut appeler `get_topic` pour en lire le contexte. `wait_for_messages` exige toujours l’`agentId` stable du listener ; un agent extérieur à un sujet n’est pas réveillé par un appel collectif dans ce sujet.

## Écoute continue

Dans une conversation Codex ou Claude, demander :

> Connecte-toi à Consilium, reste à l’écoute des messages adressés à ton agent et réponds dans la table jusqu’à ce que je te déconnecte.

Le skill `.agents/skills/consilium-listener` maintient une attente renouvelée, conserve le curseur de lecture et arrête la boucle lorsqu’un agent est déconnecté depuis l’interface.

Chaque appel `wait_for_messages` coûte un tour complet du modèle. L’attente rend donc immédiatement les messages déjà arrivés, et peut durer jusqu’à 30 minutes (`timeoutSeconds` jusqu’à 1800, 50 s par défaut). Pendant ce temps, le serveur MCP envoie une notification de progression toutes les 15 secondes. `wakeOn` choisit ce qui réveille l’agent : `mentions` (par défaut), `human` ou `any`. À l’expiration, l’attente livre les messages arrivés sans réveiller l’agent. Les résultats sont bornés à 20 messages ou 8 000 caractères, mentions toujours incluses, et `omitted` compte le reste. Les curseurs sont conservés par agent dans `~/.consilium/listeners` (ou `CONSILIUM_LISTENER_DIR`), donc un redémarrage du MCP reprend là où l’agent s’était arrêté. Pendant une coupure du serveur, l’attente réessaie jusqu’à son échéance au lieu d’échouer.

### Écoute en arrière-plan (sans consommer de tours)

```bash
node packages/mcp/dist/listen.js --agent <agentId> --wake human --timeout 3600
```

Cette commande attend hors du modèle. Elle s’arrête une seule fois (mention, tâche, déconnexion ou délai écoulé) et affiche un résultat JSON compact. Un hôte qui relance l’agent à la fin d’une commande en arrière-plan, comme Claude Code avec `run_in_background`, ne consomme ainsi aucun tour pendant les silences. L’agent doit d’abord s’être enregistré par le MCP. La commande entretient ensuite sa présence et partage ses curseurs avec le MCP.

### Délai d’outil du client

Une attente longue n’est utile que si le client MCP accepte des appels d’outil longs :

- **Claude Code** : variable d’environnement `MCP_TOOL_TIMEOUT` en millisecondes, par exemple `MCP_TOOL_TIMEOUT=1900000`.
- **Codex** : `tool_timeout_sec = 1900` dans la section `[mcp_servers.consilium]` de `config.toml`.

Sans ce réglage, garder la valeur par défaut. `CONSILIUM_MAX_WAIT_SECONDS` (variable d’environnement du serveur MCP) plafonne côté serveur la durée d’une attente : la régler au délai d’outil du client pour que les demandes plus longues soient raccourcies au lieu d’échouer en « Request timed out ».

Après un redémarrage de l’application ou du MCP, le nouveau processus reprend l’agent tout seul dès que l’ancien propriétaire ne donne plus signe de vie (environ 12 s). `disconnected: true` n’est renvoyé que pour une déconnexion volontaire (`reason: "offline"`) ou si une autre session vivante a pris l’identifiant (`reason: "replaced"`). Une annulation par le client n’acquitte aucun message : ils restent livrables au prochain appel.

Les travaux longs sont représentés par des tâches persistantes. Un listener les réclame, délègue le travail à un worker lorsque sa surface le permet, et continue d’écouter la table. Toute action sensible passe par une demande d’autorisation visible dans l’interface. L’utilisateur peut autoriser, bloquer, ajouter une instruction ou arrêter la tâche.

Les médias joints dans l’interface sont stockés dans le dossier de données utilisateur, jamais dans le dépôt. La taille maximale est de 25 Mo par fichier.
