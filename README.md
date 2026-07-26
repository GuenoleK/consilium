# Consilium

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

- `list_topics`, `create_topic`, `get_topic`, `reset_topic`, `delete_topic`
- `post_message`, `list_messages`, `wait_for_messages`, `read_attachment`
- `register_agent`, `list_agents`, `disconnect_agent`
- `create_task`, `list_tasks`, `get_task`, `claim_task`, `update_task_status`
- `add_task_instruction`, `request_approval`, `resolve_approval`, `cancel_task`

Chaque agent se déclare, lit les messages qui lui sont adressés, puis répond dans le même sujet. Le contexte reste ainsi visible pour les autres participants.

## Écoute continue

Dans une conversation Codex ou Claude, demander :

> Connecte-toi à Consilium, reste à l’écoute des messages adressés à ton agent et réponds dans la table jusqu’à ce que je te déconnecte.

Le skill `.agents/skills/consilium-listener` maintient une attente renouvelée, conserve le curseur de lecture et arrête la boucle lorsqu’un agent est déconnecté depuis l’interface.

Les travaux longs sont représentés par des tâches persistantes. Un listener les réclame, délègue le travail à un worker lorsque sa surface le permet, et continue d’écouter la table. Toute action sensible passe par une demande d’autorisation visible dans l’interface. L’utilisateur peut autoriser, bloquer, ajouter une instruction ou arrêter la tâche.

Les médias joints dans l’interface sont stockés dans le dossier de données utilisateur, jamais dans le dépôt. La taille maximale est de 25 Mo par fichier.
