import type { Translations } from "./en";

export const fr: Translations = {
  app: {
    title: "Consilium — La table ronde des agents",
  },

  common: {
    you: "Vous",
    close: "Fermer",
    cancel: "Annuler",
    confirm: "Confirmer",
    unknownModel: "Modèle non déclaré",
    attachment: "Pièce jointe",
    messageCount: { one: "{count} message", other: "{count} messages" },
    fileKind: { image: "IMAGE", video: "VIDÉO", audio: "AUDIO", file: "FICHIER" },
    fileSize: { bytes: "{value} o", kilobytes: "{value} Ko", megabytes: "{value} Mo" },
  },

  agentStatus: {
    online: "Connecté",
    listening: "En écoute",
    working: "En réflexion",
    away: "Inactif",
    offline: "Déconnecté",
  },

  taskStatus: {
    pending: "À prendre",
    claimed: "Prise en charge",
    running: "En cours",
    awaiting_approval: "Votre décision",
    waiting_for_input: "Instruction attendue",
    completed: "Terminée",
    failed: "Échec",
    cancelled: "Annulée",
  },

  roundTable: {
    error: {
      unreachable: "Impossible de joindre la table. Vérifiez que le serveur Consilium est démarré.",
    },
    header: {
      fallbackTitle: "La table se prépare…",
      fallbackDescription: "Contexte partagé entre humains et agents",
      showTopics: "Afficher les sujets",
      collapseTopics: "Rétracter les sujets",
      showParticipants: "Afficher les participants",
      collapseParticipants: "Rétracter les participants",
      openSettings: "Ouvrir les paramètres",
      settings: "Paramètres",
    },
    backdrop: {
      closeParticipants: "Fermer le volet des participants",
      closePanel: "Fermer le panneau",
    },
    attention: {
      mention: {
        title: "{name} vous mentionne",
        fallbackBody: "Un agent attend votre retour.",
      },
      authorization: {
        title: "Autorisation demandée",
        body: "{name} souhaite {action}.",
      },
      approval: {
        title: "Validation demandée",
        body: "{title} : {action}.",
      },
    },
    confirmations: {
      fallbackTopicName: "ce sujet",
      resetTopic: {
        title: "Vider ce sujet ?",
        message: "Les messages, tâches et autorisations de « {topic} » seront supprimés. Le sujet restera disponible.",
        confirmLabel: "Vider les messages",
      },
      deleteTopic: {
        title: "Supprimer ce sujet ?",
        message: "« {topic} », ses messages, ses tâches et ses médias seront supprimés définitivement.",
        confirmLabel: "Supprimer le sujet",
      },
      disconnectAgent: {
        title: "Déconnecter cet agent ?",
        message: "{agent} ne recevra plus les nouveaux messages de la table jusqu’à sa prochaine connexion.",
        confirmLabel: "Déconnecter",
      },
      deleteAgent: {
        title: "Supprimer cet agent ?",
        message: "{agent} sera retiré de la liste des agents et de toutes ses rooms. Ses messages historiques seront conservés.",
        confirmLabel: "Supprimer l’agent",
      },
      cancelTask: {
        title: "Arrêter cette tâche ?",
        message: "Le worker recevra une demande d’arrêt. La tâche restera conservée dans ce sujet.",
        confirmLabel: "Arrêter la tâche",
      },
      deleteTask: {
        title: "Supprimer cette tâche ?",
        message: "Cette tâche et son historique seront supprimés définitivement. Cette action est irréversible.",
        confirmLabel: "Supprimer la tâche",
      },
    },
  },

  topicList: {
    brand: { tagline: "La table ronde" },
    mobileClose: "Fermer les sujets",
    create: "Nouveau sujet",
    heading: "Sujets",
    navigation: "Sujets de discussion",
    itemUnread: "{title} · Messages non lus",
  },

  agentPanel: {
    header: {
      eyebrow: "Autour de la table",
      participants: { one: "{count} participant connecté", other: "{count} participants connectés" },
      refresh: "Rafraîchir les agents",
      closeParticipants: "Fermer les participants",
    },
    human: {
      role: "Hôte de la discussion",
      online: "En ligne",
    },
    agents: {
      label: "Agents",
      thinking: "Réflexion en cours",
      busyElsewhere: "Occupé dans « {topic} »",
      anotherConversation: "une autre conversation",
      delete: "Supprimer {name}",
      disconnect: "Déconnecter {name}",
    },
    free: {
      label: "Libres",
      empty: "Aucun agent n’est actuellement sans room.",
    },
    rooms: {
      label: "Rooms",
      empty: "Aucune conversation ouverte.",
      emptyRoom: "Aucun agent autour de cette room. Ajoutez-en un avec le bouton +.",
      agentCount: { one: "{count} agent", other: "{count} agents" },
    },
    sort: {
      label: "Organiser les rooms",
      heading: "Trier les rooms par",
      alphabetical: "Alphabétique",
      chronological: "Chronologique",
      custom: "Ordre manuel",
    },
  },

  participantPicker: {
    add: "Ajouter un agent à cette conversation",
    addShort: "Ajouter un agent",
    allParticipating: "Tous les agents déclarés participent déjà",
    menu: "Agents déclarés à ajouter",
    label: "Ajouter à cette room",
    error: "Ajout impossible pour le moment.",
  },

  agentTypingIndicator: {
    label: "Agents en réflexion",
    status: "En réflexion",
    typing: "{name} est en train d’écrire",
  },

  authorizationBubble: {
    label: "Autorisations en attente",
    title: "Autorisation demandée",
    kind: { fileAttachment: "Partage de fichier", action: "Action proposée" },
    request: "{name} souhaite {action}",
    reject: "Refuser",
    approve: "Autoriser",
  },

  conversationActions: {
    resetTitle: "Vider les messages",
    resetLabel: "Réinitialiser la conversation",
    deleteTitle: "Supprimer le sujet",
    deleteLabel: "Supprimer la conversation",
  },

  messageComposer: {
    placeholder: "Écrivez un message… Tapez @ pour un agent ou # pour une conversation",
    label: "Votre message",
    hint: "Les agents mentionnés reçoivent le message. Utilisez # pour donner une conversation de référence.",
    defaultFileMessage: "Fichier partagé",
    replyTo: "Réponse à {name}",
    cancelReply: "Annuler la réponse",
    attach: "Joindre des fichiers",
    dropHint: "Déposer les fichiers ici",
    limit: "{size} Mo maximum par fichier",
    fileTooLarge: "Un fichier dépasse la limite de {size} Mo.",
    status: { sending: "Envoi en cours…", sendingMedia: "Envoi des médias…" },
    send: { idle: "Envoyer", sending: "Envoi en cours", sendingMedia: "Envoi des médias en cours" },
  },

  attachmentList: {
    label: "Fichiers joints",
    remove: "Retirer {name}",
  },

  mentionSuggestions: {
    label: "Agents participants",
    heading: "Mentionner un agent de la room",
  },

  conversationSuggestions: {
    label: "Conversations à référencer",
    heading: "Référencer une conversation",
  },

  messageList: {
    today: "Aujourd’hui",
    agentBadge: "Agent",
    loading: "Chargement…",
    loadOlder: "Afficher les messages précédents",
    download: "Télécharger {name}",
    reply: {
      jumpLabel: "Afficher le message cité de {name}",
      jumpTitle: "Remonter au message cité",
      action: "Répondre",
      actionLabel: "Répondre au message de {name}",
    },
    copy: {
      action: "Copier",
      copied: "Copié",
      failed: "Échec",
      label: "Copier la réponse",
      title: "Copier la réponse avec sa mise en forme",
      copiedLabel: "Réponse copiée",
      failedLabel: "Échec de la copie",
    },
  },

  mediaGallery: {
    label: "Médias joints",
    open: "Ouvrir {name}",
    preview: "Aperçu de {name}",
    info: "Informations sur {name}",
    close: "Fermer l’aperçu",
    previous: "Média précédent",
    next: "Média suivant",
  },

  newTopicDialog: {
    eyebrow: "Nouveau sujet",
    title: "Ouvrir une nouvelle table",
    name: "Nom du sujet",
    namePlaceholder: "Ex. Refonte de l’onboarding",
    context: "Contexte",
    optional: "Optionnel",
    contextPlaceholder: "Donnez aux participants quelques repères pour commencer la discussion…",
    error: "Le sujet n’a pas pu être créé. Vérifiez que Consilium est bien démarré.",
    submit: "Créer le sujet",
    submitting: "Création…",
  },

  settingsDialog: {
    header: { eyebrow: "Configuration", title: "Paramètres de Consilium", close: "Fermer les paramètres" },
    language: {
      title: "Langue",
      description: "Choisissez la langue de l’interface.",
      auto: "Automatique",
    },
    notifications: {
      title: "Notifications système",
      description: "Recevoir une alerte lorsque Consilium attend votre attention.",
      status: {
        unsupported: "Ce navigateur ne prend pas en charge les notifications système.",
        denied: "Les notifications sont bloquées dans les réglages du navigateur.",
        default: "Autorisez les notifications pour être averti hors de la fenêtre.",
      },
    },
    mcp: {
      title: "Connexion MCP",
      description: "Le contexte partagé reste disponible pour les agents connectés.",
      sync: "Synchroniser maintenant",
      syncing: "Synchronisation…",
    },
  },

  notificationToggle: {
    label: "Notifications système",
  },

  systemNotifications: {
    digestTitle: { one: "Consilium · {count} demande d’attention", other: "Consilium · {count} demandes d’attention" },
    mentions: { one: "{count} mention", other: "{count} mentions" },
    approvals: { one: "{count} validation", other: "{count} validations" },
    authorizations: { one: "{count} autorisation", other: "{count} autorisations" },
  },

  taskQueue: {
    header: {
      title: "Tâches",
      count: "{count} dans ce sujet",
      pending: { one: "{count} décision", other: "{count} décisions" },
      create: "Créer une tâche",
    },
    form: {
      title: "Titre de la tâche",
      description: "Résultat attendu et contraintes",
      unassigned: "Agent non assigné",
      submit: "Créer la tâche",
    },
    sections: {
      active: "Tâches actives",
      completed: "Tâches terminées",
      archived: "Tâches archivées",
    },
    empty: {
      active: "Aucune tâche active. Créez-en une pour déléguer un travail à un agent.",
      completed: "Aucune tâche terminée.",
      archived: "Aucune tâche archivée.",
    },
  },

  taskItem: {
    approval: {
      riskRestricted: "Risque : sensible",
      riskConfirmation: "Risque : confirmation",
      block: "Bloquer",
      allow: "Autoriser",
      rejectedNote: "Action refusée depuis Consilium",
    },
    instructions: {
      count: { one: "{count} instruction complémentaire", other: "{count} instructions complémentaires" },
      placeholder: "Ajoutez une contrainte ou une précision…",
      send: "Envoyer l’instruction",
    },
    actions: {
      instruct: "Instruire",
      stop: "Arrêter",
      archive: "Archiver",
      unarchive: "Désarchiver",
      delete: "Supprimer",
    },
  },

  confirmDialog: {
    eyebrow: "Confirmation",
    fallbackTitle: "Confirmation",
    inProgress: "En cours…",
    error: "L’action n’a pas pu être effectuée. Réessayez.",
  },
};
