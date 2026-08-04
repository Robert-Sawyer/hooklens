import { z } from "zod";

const deliveryStatusSchema = z.enum(["pending", "delivered", "failed"]);

const eventTypeSchema = z
  .string()
  .trim()
  .min(3)
  .max(100)
  .regex(
    /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/,
    "Event type must use lowercase segments, for example payment.completed.",
  );

export const intakeWebhookSchema = z.object({
  eventType: eventTypeSchema,
  payload: z.record(z.string(), z.unknown()),
  targetUrl: z.string().url().max(2048),
  requestHeaders: z.record(z.string(), z.string()).default({}),
  attempt: z
    .object({
      status: deliveryStatusSchema.default("pending"),
      httpStatus: z.number().int().min(100).max(599).optional(),
      responseBody: z.string().max(20_000).optional(),
      durationMs: z.number().int().min(0).max(300_000).optional(),
    })
    .default({}),
});

export const deliveryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  status: deliveryStatusSchema.optional(),
  eventType: eventTypeSchema.optional(),
});

export const deliveryIdParamsSchema = z.object({
  deliveryId: z.string().uuid(),
});

export type IntakeWebhookInput = z.infer<typeof intakeWebhookSchema>;
export type DeliveryListQuery = z.infer<typeof deliveryListQuerySchema>;
