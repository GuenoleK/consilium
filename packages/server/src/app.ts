import { Hono } from "hono";
import { cors } from "hono/cors";
import { z } from "zod";
import { getRemoteAccessStatus } from "./remoteAccess.js";
import { ConsiliumStore } from "./store.js";

export const createApp = (store = new ConsiliumStore()) => {
  const agentIdSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{0,31}$/);
  const app = new Hono();
  app.use("/api/*", cors({ origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }));
  app.get("/api/health", (context) => context.json({ ok: true }));
  app.get("/api/remote-access", async (context) => context.json(await getRemoteAccessStatus()));
  app.get("/api/topics", async (context) => context.json(await store.listTopics()));
  app.post("/api/topics", async (context) => {
    const input = z.object({ title: z.string().min(1), description: z.string().default("") }).parse(await context.req.json());
    return context.json(await store.createTopic(input), 201);
  });
  app.post("/api/topics/:id/reset", async (context) => {
    const topic = await store.resetTopic(context.req.param("id"));
    return topic ? context.json(topic) : context.json({ error: "Topic not found" }, 404);
  });
  app.delete("/api/topics/:id", async (context) => {
    const deleted = await store.deleteTopic(context.req.param("id"));
    return deleted ? context.body(null, 204) : context.json({ error: "Topic not found" }, 404);
  });
  app.get("/api/topics/:id", async (context) => {
    const topic = await store.getTopic(context.req.param("id"));
    return topic ? context.json(topic) : context.json({ error: "Topic not found" }, 404);
  });
  app.get("/api/topics/:id/messages", async (context) => {
    const before = context.req.query("before");
    const limit = context.req.query("limit");
    if (before !== undefined || limit !== undefined) {
      const query = z.object({
        before: z.string().datetime().optional(),
        limit: z.coerce.number().int().min(1).max(100).default(60),
      }).safeParse({ before, limit });
      if (!query.success) return context.json({ error: "Invalid message page query" }, 400);
      return context.json(await store.listMessagePage(context.req.param("id"), query.data.before, query.data.limit));
    }
    return context.json(await store.listMessages(context.req.param("id"), context.req.query("since")));
  });
  app.post("/api/topics/:id/messages", async (context) => {
    const input = z.object({
      authorId: z.string().min(1), authorName: z.string().min(1),
      authorKind: z.enum(["human", "agent", "system"]), body: z.string().min(1),
      attachmentIds: z.array(z.string()).default([]),
    }).parse(await context.req.json());
    const { attachmentIds, ...messageInput } = input;
    const message = await store.addMessage({ ...messageInput, attachments: [], topicId: context.req.param("id") });
    return context.json(attachmentIds.length ? await store.attachToMessage(message.id, attachmentIds) : message, 201);
  });
  app.post("/api/topics/:id/attachments", async (context) => {
    const body = await context.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) return context.json({ error: "A file is required" }, 400);
    if (file.size > 25 * 1024 * 1024) return context.json({ error: "File exceeds 25 MB" }, 413);
    return context.json(await store.saveAttachment(context.req.param("id"), file), 201);
  });
  app.get("/api/attachments/:id", async (context) => {
    const found = await store.getAttachment(context.req.param("id"));
    if (!found) return context.json({ error: "Attachment not found" }, 404);
    return new Response(found.data, {
      headers: {
        "content-type": found.attachment.mediaType,
        "content-length": String(found.attachment.size),
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(found.attachment.name)}`,
      },
    });
  });
  app.get("/api/agents", async (context) => context.json(await store.listAgents()));
  app.post("/api/agents", async (context) => {
    const input = z.object({ id: agentIdSchema, name: z.string().trim().min(1).max(80), model: z.string().trim().min(1).optional(), status: z.enum(["online", "listening", "working", "away", "offline"]).default("online") }).parse(await context.req.json());
    return context.json(await store.registerAgent(input));
  });
  app.post("/api/agents/:id/disconnect", async (context) => {
    const agent = await store.disconnectAgent(context.req.param("id"));
    return agent ? context.json(agent) : context.json({ error: "Agent not found" }, 404);
  });
  app.get("/api/tasks", async (context) => context.json(await store.listTasks({
    topicId: context.req.query("topicId"),
    assignedAgentId: context.req.query("assignedAgentId"),
    activeOnly: context.req.query("activeOnly") === "true",
  })));
  app.post("/api/tasks", async (context) => {
    const input = z.object({
      topicId: z.string().min(1), title: z.string().min(1), description: z.string().default(""),
      requestedBy: z.string().min(1), assignedAgentId: z.string().optional(), clientRequestId: z.string().optional(),
    }).parse(await context.req.json());
    return context.json(await store.createTask(input), 201);
  });
  app.get("/api/tasks/:id", async (context) => {
    const task = await store.getTask(context.req.param("id"));
    return task ? context.json(task) : context.json({ error: "Task not found" }, 404);
  });
  app.post("/api/tasks/:id/claim", async (context) => {
    const input = z.object({ agentId: z.string().min(1), workerId: z.string().optional() }).parse(await context.req.json());
    try {
      const task = await store.claimTask(context.req.param("id"), input.agentId, input.workerId);
      return task ? context.json(task) : context.json({ error: "Task not found" }, 404);
    } catch (error) {
      return context.json({ error: error instanceof Error ? error.message : String(error) }, 409);
    }
  });
  app.patch("/api/tasks/:id", async (context) => {
    const input = z.object({
      status: z.enum(["pending", "claimed", "running", "awaiting_approval", "waiting_for_input", "completed", "failed", "cancelled"]).optional(),
      progress: z.number().int().min(0).max(100).optional(), result: z.string().optional(),
      error: z.string().optional(), workerId: z.string().optional(),
    }).parse(await context.req.json());
    const task = await store.updateTask(context.req.param("id"), input);
    return task ? context.json(task) : context.json({ error: "Task not found" }, 404);
  });
  app.post("/api/tasks/:id/instructions", async (context) => {
    const input = z.object({ authorId: z.string().min(1), authorName: z.string().min(1), body: z.string().min(1) }).parse(await context.req.json());
    const task = await store.addTaskInstruction(context.req.param("id"), input);
    return task ? context.json(task) : context.json({ error: "Task not found" }, 404);
  });
  app.post("/api/tasks/:id/approvals", async (context) => {
    const input = z.object({
      requestedBy: z.string().min(1), action: z.string().min(1), details: z.string().min(1),
      riskLevel: z.enum(["free", "confirmation", "restricted"]),
    }).parse(await context.req.json());
    const approval = await store.requestApproval(context.req.param("id"), input);
    return approval ? context.json(approval, 201) : context.json({ error: "Task not found" }, 404);
  });
  app.post("/api/tasks/:taskId/approvals/:approvalId/resolve", async (context) => {
    const input = z.object({
      decision: z.enum(["approved", "rejected"]), resolvedBy: z.string().min(1), decisionNote: z.string().optional(),
    }).parse(await context.req.json());
    try {
      const result = await store.resolveApproval(context.req.param("taskId"), context.req.param("approvalId"), input);
      return result ? context.json(result) : context.json({ error: "Task or approval not found" }, 404);
    } catch (error) {
      return context.json({ error: error instanceof Error ? error.message : String(error) }, 409);
    }
  });
  app.post("/api/tasks/:id/cancel", async (context) => {
    const input = z.object({ requestedBy: z.string().min(1) }).parse(await context.req.json());
    const task = await store.cancelTask(context.req.param("id"), input.requestedBy);
    return task ? context.json(task) : context.json({ error: "Task not found" }, 404);
  });
  return app;
};
