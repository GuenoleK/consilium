// English is the source of truth: `fr.ts` is typed against this object, so a key
// missing from any locale fails the typecheck. Keys are grouped by block, like BEM
// classes (`settingsDialog.header.title` ↔ `.settings-dialog__header`). A node with an
// `other` entry is a plural: pass `{ count }` to `t()`.
export const en = {
  app: {
    title: "Consilium — The agents’ round table",
  },

  common: {
    you: "You",
    close: "Close",
    cancel: "Cancel",
    confirm: "Confirm",
    unknownModel: "Model not declared",
    attachment: "Attachment",
    messageCount: { one: "{count} message", other: "{count} messages" },
    fileKind: { image: "IMAGE", video: "VIDEO", audio: "AUDIO", file: "FILE" },
    fileSize: { bytes: "{value} B", kilobytes: "{value} KB", megabytes: "{value} MB" },
  },

  agentStatus: {
    online: "Connected",
    listening: "Listening",
    working: "Thinking",
    away: "Away",
    offline: "Disconnected",
  },

  taskStatus: {
    pending: "Available",
    claimed: "Claimed",
    running: "Running",
    awaiting_approval: "Your decision",
    waiting_for_input: "Waiting for instruction",
    completed: "Completed",
    failed: "Failed",
    cancelled: "Cancelled",
  },

  roundTable: {
    error: {
      unreachable: "Unable to reach the table. Check that the Consilium server is running.",
    },
    header: {
      fallbackTitle: "Setting up the table…",
      fallbackDescription: "Context shared between humans and agents",
      showTopics: "Show topics",
      collapseTopics: "Collapse topics",
      showParticipants: "Show participants",
      collapseParticipants: "Collapse participants",
      openSettings: "Open settings",
      settings: "Settings",
    },
    backdrop: {
      closeParticipants: "Close the participants pane",
      closePanel: "Close panel",
    },
    attention: {
      mention: {
        title: "{name} mentioned you",
        fallbackBody: "An agent is waiting for your reply.",
      },
      authorization: {
        title: "Authorization requested",
        body: "{name} wants to {action}.",
      },
      approval: {
        title: "Approval requested",
        body: "{title}: {action}.",
      },
    },
    confirmations: {
      fallbackTopicName: "this topic",
      resetTopic: {
        title: "Clear this topic?",
        message: "The messages, tasks and authorizations of “{topic}” will be deleted. The topic itself will remain.",
        confirmLabel: "Clear messages",
      },
      deleteTopic: {
        title: "Delete this topic?",
        message: "“{topic}”, its messages, its tasks and its media will be permanently deleted.",
        confirmLabel: "Delete topic",
      },
      disconnectAgent: {
        title: "Disconnect this agent?",
        message: "{agent} will no longer receive new messages from the table until it connects again.",
        confirmLabel: "Disconnect",
      },
      deleteAgent: {
        title: "Delete this agent?",
        message: "{agent} will be removed from the agent list and from all its rooms. Its past messages will be kept.",
        confirmLabel: "Delete agent",
      },
      cancelTask: {
        title: "Stop this task?",
        message: "The worker will receive a stop request. The task will stay in this topic.",
        confirmLabel: "Stop task",
      },
      deleteTask: {
        title: "Delete this task?",
        message: "This task and its history will be permanently deleted. This action cannot be undone.",
        confirmLabel: "Delete task",
      },
    },
  },

  topicList: {
    brand: { tagline: "The round table" },
    mobileClose: "Close topics",
    create: "New topic",
    heading: "Topics",
    navigation: "Discussion topics",
    itemUnread: "{title} · Unread messages",
  },

  agentPanel: {
    header: {
      eyebrow: "Around the table",
      participants: { one: "{count} participant connected", other: "{count} participants connected" },
      refresh: "Refresh agents",
      closeParticipants: "Close participants",
    },
    human: {
      role: "Discussion host",
      online: "Online",
    },
    agents: {
      label: "Agents",
      thinking: "Thinking",
      busyElsewhere: "Busy in “{topic}”",
      anotherConversation: "another conversation",
      delete: "Delete {name}",
      disconnect: "Disconnect {name}",
    },
    free: {
      label: "Unassigned",
      empty: "No agent is currently outside a room.",
    },
    rooms: {
      label: "Rooms",
      empty: "No open conversation.",
      emptyRoom: "No agent around this room. Add one with the + button.",
      agentCount: { one: "{count} agent", other: "{count} agents" },
    },
    sort: {
      label: "Organize rooms",
      heading: "Sort rooms by",
      alphabetical: "Alphabetical",
      chronological: "Chronological",
      custom: "Manual order",
    },
  },

  participantPicker: {
    add: "Add an agent to this conversation",
    addShort: "Add an agent",
    allParticipating: "All declared agents are already participating",
    menu: "Declared agents to add",
    label: "Add to this room",
    error: "Unable to add right now.",
  },

  agentTypingIndicator: {
    label: "Agents thinking",
    status: "Thinking",
    typing: "{name} is typing",
  },

  authorizationBubble: {
    label: "Pending authorizations",
    title: "Authorization requested",
    kind: { fileAttachment: "File sharing", action: "Proposed action" },
    request: "{name} wants to {action}",
    reject: "Decline",
    approve: "Allow",
  },

  conversationActions: {
    resetTitle: "Clear messages",
    resetLabel: "Reset conversation",
    deleteTitle: "Delete topic",
    deleteLabel: "Delete conversation",
  },

  messageComposer: {
    placeholder: "Write a message… Type @ for an agent or # for a conversation",
    label: "Your message",
    hint: "Mentioned agents receive the message. Use # to give a reference conversation.",
    defaultFileMessage: "Shared file",
    replyTo: "Replying to {name}",
    cancelReply: "Cancel reply",
    attach: "Attach files",
    dropHint: "Drop files here",
    limit: "{size} MB maximum per file",
    fileTooLarge: "A file exceeds the {size} MB limit.",
    status: { sending: "Sending…", sendingMedia: "Sending media…" },
    send: { idle: "Send", sending: "Sending", sendingMedia: "Sending media" },
  },

  attachmentList: {
    label: "Attached files",
    remove: "Remove {name}",
  },

  mentionSuggestions: {
    label: "Participating agents",
    heading: "Mention an agent in the room",
  },

  conversationSuggestions: {
    label: "Conversations to reference",
    heading: "Reference a conversation",
  },

  messageList: {
    today: "Today",
    agentBadge: "Agent",
    loading: "Loading…",
    loadOlder: "Show previous messages",
    download: "Download {name}",
    reply: {
      jumpLabel: "Show the quoted message from {name}",
      jumpTitle: "Go to the quoted message",
      action: "Reply",
      actionLabel: "Reply to the message from {name}",
    },
    copy: {
      action: "Copy",
      copied: "Copied",
      failed: "Failed",
      label: "Copy reply",
      title: "Copy reply with its formatting",
      copiedLabel: "Reply copied",
      failedLabel: "Copy failed",
    },
  },

  mediaGallery: {
    label: "Attached media",
    open: "Open {name}",
    preview: "Preview of {name}",
    info: "Information about {name}",
    close: "Close preview",
    previous: "Previous media",
    next: "Next media",
  },

  newTopicDialog: {
    eyebrow: "New topic",
    title: "Open a new table",
    name: "Topic name",
    namePlaceholder: "e.g. Onboarding redesign",
    context: "Context",
    optional: "Optional",
    contextPlaceholder: "Give participants a few pointers to start the discussion…",
    error: "The topic could not be created. Check that Consilium is running.",
    submit: "Create topic",
    submitting: "Creating…",
  },

  settingsDialog: {
    header: { eyebrow: "Configuration", title: "Consilium settings", close: "Close settings" },
    language: {
      title: "Language",
      description: "Choose the language of the interface.",
      auto: "Automatic",
    },
    notifications: {
      title: "System notifications",
      description: "Get an alert when Consilium needs your attention.",
      status: {
        unsupported: "This browser does not support system notifications.",
        denied: "Notifications are blocked in the browser settings.",
        default: "Allow notifications to be alerted while outside the window.",
      },
    },
    mcp: {
      title: "MCP connection",
      description: "Shared context stays available to connected agents.",
      sync: "Sync now",
      syncing: "Syncing…",
    },
  },

  notificationToggle: {
    label: "System notifications",
  },

  systemNotifications: {
    digestTitle: { one: "Consilium · {count} request for attention", other: "Consilium · {count} requests for attention" },
    mentions: { one: "{count} mention", other: "{count} mentions" },
    approvals: { one: "{count} approval", other: "{count} approvals" },
    authorizations: { one: "{count} authorization", other: "{count} authorizations" },
  },

  taskQueue: {
    header: {
      title: "Tasks",
      count: "{count} in this topic",
      pending: { one: "{count} decision", other: "{count} decisions" },
      create: "Create a task",
    },
    form: {
      title: "Task title",
      description: "Expected outcome and constraints",
      unassigned: "Unassigned agent",
      submit: "Create task",
    },
    sections: {
      active: "Active tasks",
      completed: "Completed tasks",
      archived: "Archived tasks",
    },
    empty: {
      active: "No active tasks. Create one to delegate work to an agent.",
      completed: "No completed tasks.",
      archived: "No archived tasks.",
    },
  },

  taskItem: {
    approval: {
      riskRestricted: "Risk: sensitive",
      riskConfirmation: "Risk: confirmation",
      block: "Block",
      allow: "Allow",
      rejectedNote: "Action declined from Consilium",
    },
    instructions: {
      count: { one: "{count} additional instruction", other: "{count} additional instructions" },
      placeholder: "Add a constraint or a clarification…",
      send: "Send instruction",
    },
    actions: {
      instruct: "Instruct",
      stop: "Stop",
      archive: "Archive",
      unarchive: "Unarchive",
      delete: "Delete",
    },
  },

  confirmDialog: {
    eyebrow: "Confirmation",
    fallbackTitle: "Confirmation",
    inProgress: "In progress…",
    error: "The action could not be completed. Try again.",
  },
};

export type Translations = typeof en;
