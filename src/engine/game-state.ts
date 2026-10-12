import { z } from 'zod';
import { stageSchema, statsSchema } from '../content/schema.ts';

const id = z.string().regex(/^[a-z][a-z0-9_]*$/);
const uint32 = z.number().int().min(0).max(0xffffffff);
export const gameStateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  contentVersion: z.string().min(1),
  seed: uint32,
  rng: z.strictObject({ algorithm: z.literal('mulberry32-v1'), state: uint32 }),
  status: z.enum(['birth', 'playing', 'ended']),
  worldId: id, entityId: id, birthEntityId: id,
  birthLocationId: id.nullable(), traitId: id.nullable(), flawId: id.nullable(), hiddenFateId: id.nullable(),
  hiddenFateRevealed: z.boolean(),
  stage: stageSchema,
  currentEventId: id.nullable(), endingId: id.nullable(),
  stats: statsSchema,
  tags: z.array(id), flags: z.record(id, z.boolean()), items: z.array(id),
  visitedEventIds: z.array(id),
  choiceHistory: z.array(z.strictObject({
    eventId: id, choiceId: id, stage: stageSchema, entityId: id, resultText: z.string(),
  })),
  completedEventCount: z.number().int().min(0).max(12),
  birthStory: z.string(),
});

export type GameState = z.infer<typeof gameStateSchema>;
