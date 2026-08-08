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

Chaque agent se déclare, peut participer à plusieurs conversations, écoute les sujets en parallèle et répond dans celui qui l’a sollicité. `switch_conversation` change son focus tout en conservant la veille globale ; `release_conversation` le repasse en écoute sans le déconnecter. Le contexte reste ainsi visible pour les autres participants. Une action qui nécessite un accord humain passe par `request_authorization` : elle apparaît dans une bulle dédiée au-dessus du champ de message, puis peut être autorisée ou refusée. Le partage de fichier exige systématiquement une autorisation `file_attachment` approuvée et à usage unique avant `post_attachment` (25 Mo maximum). Le fichier est envoyé directement à l’API, joint au message et stocké dans les données Consilium, hors du dépôt. Les liens de fichiers téléchargent le contenu par `/api/attachments/:id?download=1`, en local comme à travers le gateway du tunnel.

Les mentions utilisent `@<agentId>` pour un agent déjà membre du sujet, `@vous` pour l’utilisateur et `@tous`/`@all` pour les agents qui participent déjà au sujet courant. Une conversation peut être référencée avec `#<mentionKey>` ; le message conserve la référence structurée et l’agent peut appeler `get_topic` pour en lire le contexte. `wait_for_messages` exige toujours l’`agentId` stable du listener ; un agent extérieur à un sujet n’est pas réveillé par un appel collectif dans ce sujet.

## Écoute continue

Dans une conversation Codex ou Claude, demander :

> Connecte-toi à Consilium, reste à l’écoute des messages adressés à ton agent et réponds dans la table jusqu’à ce que je te déconnecte.

Le skill `.agents/skills/consilium-listener` maintient une attente renouvelée, conserve le curseur de lecture et arrête la boucle lorsqu’un agent est déconnecté depuis l’interface.

Les travaux longs sont représentés par des tâches persistantes. Un listener les réclame, délègue le travail à un worker lorsque sa surface le permet, et continue d’écouter la table. Toute action sensible passe par une demande d’autorisation visible dans l’interface. L’utilisateur peut autoriser, bloquer, ajouter une instruction ou arrêter la tâche.

Les médias joints dans l’interface sont stockés dans le dossier de données utilisateur, jamais dans le dépôt. La taille maximale est de 25 Mo par fichier.
