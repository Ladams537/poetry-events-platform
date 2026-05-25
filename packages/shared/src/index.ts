import { z } from "zod";

export const idSchema = z.string().uuid();

export const isoDateTimeSchema = z.string().datetime({ offset: true });

export const userPublicSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  email: z.string().email(),
  createdAt: isoDateTimeSchema
});

export const authRegisterBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128)
});

export const authLoginBodySchema = z.object({
  email: z.string().trim().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128)
});

export const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: userPublicSchema
});

export const eventCreateBodySchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2_000),
  venue: z.string().trim().min(2).max(160),
  startsAt: isoDateTimeSchema,
  capacity: z.number().int().min(1).max(500).optional()
});

export const eventUpdateBodySchema = eventCreateBodySchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one event field is required"
);

export const attendeeSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  rsvpedAt: isoDateTimeSchema
});

export const eventSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  venue: z.string().min(1),
  startsAt: isoDateTimeSchema,
  capacity: z.number().int().positive().nullable(),
  host: userPublicSchema,
  attendeeCount: z.number().int().nonnegative(),
  attendees: z.array(attendeeSchema).optional(),
  currentUserRsvped: z.boolean().optional(),
  createdAt: isoDateTimeSchema,
  cancelledAt: isoDateTimeSchema.nullable()
});

export const eventsListResponseSchema = z.object({
  events: z.array(eventSchema)
});

export const eventResponseSchema = z.object({
  event: eventSchema.extend({
    attendees: z.array(attendeeSchema)
  })
});

export const recommendationSchema = z.object({
  event: eventSchema,
  score: z.number().positive(),
  sharedEventCount: z.number().int().positive(),
  adjacentUserCount: z.number().int().positive()
});

export const recommendationsResponseSchema = z.object({
  recommendations: z.array(recommendationSchema),
  algorithm: z.literal("weighted-co-attendance")
});

export const apiErrorSchema = z.object({
  error: z.string(),
  issues: z.array(z.string()).optional()
});

export type UserPublic = z.infer<typeof userPublicSchema>;
export type AuthRegisterBody = z.infer<typeof authRegisterBodySchema>;
export type AuthLoginBody = z.infer<typeof authLoginBodySchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type EventCreateBody = z.infer<typeof eventCreateBodySchema>;
export type EventUpdateBody = z.infer<typeof eventUpdateBodySchema>;
export type Attendee = z.infer<typeof attendeeSchema>;
export type Event = z.infer<typeof eventSchema>;
export type EventsListResponse = z.infer<typeof eventsListResponseSchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type RecommendationsResponse = z.infer<typeof recommendationsResponseSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
