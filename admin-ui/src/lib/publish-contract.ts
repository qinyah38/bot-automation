import { z } from "zod";

const recordConfigSchema = z.record(z.unknown());

export const triggerSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  name: z.string(),
  detail: z.string().optional(),
  config: recordConfigSchema.default({}),
});

export const flowStepSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  name: z.string(),
  summary: z.string().optional(),
  status: z.enum(["Draft", "Configured", "Ready"]),
  config: recordConfigSchema.default({}),
});

export const integrationSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  enabled: z.boolean(),
  config: recordConfigSchema.optional(),
});

export const publishBotRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().max(512).optional(),
  locale: z.string().min(2),
  requestedVersion: z.number().int().positive(),
  changeSummary: z.array(z.string()).default([]),
  assignedNumbers: z.array(z.string()).default([]),
  autoAssign: z.boolean(),
  actorId: z.string().uuid().optional(),
  actorEmail: z.string().email().optional(),
  actorName: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  flowDefinition: z.object({
    triggers: z.array(triggerSchema),
    steps: z.array(flowStepSchema),
    integrations: z.array(integrationSchema),
    metadata: z
      .object({
        autoAssign: z.boolean(),
        locale: z.string(),
      })
      .passthrough()
      .optional(),
  }),
});

export type PublishBotRequest = z.infer<typeof publishBotRequestSchema>;

export const publishBotResponseSchema = z.object({
  botId: z.string(),
  botVersionId: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.literal("published"),
  publishedAt: z.string(),
});

export type PublishBotResponse = z.infer<typeof publishBotResponseSchema>;
