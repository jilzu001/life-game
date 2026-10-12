import { z } from 'zod';

export const STAT_KEYS = ['survival', 'influence', 'intelligence', 'freedom', 'chaos'] as const;
export const STAGES = ['birth', 'awakening', 'growth', 'crisis', 'transition', 'climax', 'conclusion'] as const;
export const statKeySchema = z.enum(STAT_KEYS);
export const stageSchema = z.enum(STAGES);
const id = z.string().regex(/^[a-z][a-z0-9_]*$/);
const text = z.string().trim().min(1);
const version = z.literal(1);
const positiveWeight = z.number().finite().positive().max(1_000_000);
export const relativePath = z.string().regex(/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\.[a-zA-Z0-9]+$/);
export const imagePathSchema = relativePath.regex(/^images\/.+\.(svg|webp)$/);
const jsonPath = relativePath.regex(/\.json$/);
const ids = z.array(id);
const comparison = z.enum(['gte', 'lte', 'equals', 'notEquals']);
const equality = z.enum(['equals', 'notEquals']);
const stat = z.number().finite().min(0).max(100);
export const statsSchema = z.strictObject({
  survival: stat, influence: stat, intelligence: stat, freedom: stat, chaos: stat,
});

// 출생 조건은 현재 단계까지 추첨된 상태만 참조한다.
const birthLeafSchema = z.union([
  z.strictObject({ type: z.literal('stat'), key: statKeySchema, operator: comparison, value: stat }),
  z.strictObject({ type: z.literal('flag'), key: id, operator: equality, value: z.boolean() }),
  z.strictObject({ type: z.enum(['tag', 'item']), key: id, operator: equality, value: z.boolean() }),
  z.strictObject({ type: z.enum(['world', 'entity', 'location', 'trait', 'flaw']), operator: equality, value: id }),
]);
type BirthLeaf = z.infer<typeof birthLeafSchema>;
export type BirthCondition = BirthLeaf | { all: BirthCondition[] } | { any: BirthCondition[] };
export const birthConditionSchema: z.ZodType<BirthCondition> = z.lazy(() => z.union([
  birthLeafSchema,
  z.strictObject({ all: z.array(birthConditionSchema).min(1) }),
  z.strictObject({ any: z.array(birthConditionSchema).min(1) }),
]));

const historyLeafSchema = z.union([
  z.strictObject({ type: z.literal('event'), eventId: id, operator: equality, value: z.boolean() }),
  z.strictObject({ type: z.literal('choice'), eventId: id, choiceId: id, operator: equality, value: z.boolean() }),
]);
export type Condition = BirthLeaf | z.infer<typeof historyLeafSchema> | { all: Condition[] } | { any: Condition[] };
export const conditionSchema: z.ZodType<Condition> = z.lazy(() => z.union([
  birthLeafSchema, historyLeafSchema,
  z.strictObject({ all: z.array(conditionSchema).min(1) }),
  z.strictObject({ any: z.array(conditionSchema).min(1) }),
]));

export const birthEffectSchema = z.union([
  z.strictObject({ op: z.literal('addStat'), key: statKeySchema, value: z.number().finite().min(-100).max(100) }),
  z.strictObject({ op: z.literal('setStat'), key: statKeySchema, value: stat }),
  z.strictObject({ op: z.literal('setFlag'), key: id, value: z.boolean() }),
  z.strictObject({ op: z.enum(['addTag', 'removeTag', 'addItem', 'removeItem']), key: id }),
]);
export const effectSchema = z.union([
  birthEffectSchema,
  z.strictObject({ op: z.literal('transformEntity'), entityId: id }),
]);
const optionFields = {
  id, name: text, description: text, weight: positiveWeight,
  conditions: birthConditionSchema.optional(), flags: ids, effects: z.array(birthEffectSchema),
};
export const birthOptionSchema = z.strictObject(optionFields);
export const worldSchema = z.strictObject({
  schemaVersion: version, id, name: text, description: text, image: imagePathSchema,
  weight: positiveWeight, entityIds: ids.min(1),
});
export const entitySchema = z.strictObject({
  schemaVersion: version, id, worldId: id, name: text, description: text,
  entityType: id, image: imagePathSchema, weight: positiveWeight,
  timeUnit: text, birthStory: text,
  birthLocations: z.array(birthOptionSchema).min(2).max(32),
  traits: z.array(birthOptionSchema).min(2).max(32),
  flaws: z.array(birthOptionSchema).min(2).max(32),
  hiddenFates: z.array(birthOptionSchema).min(1).max(32),
  initialStats: statsSchema, tags: ids,
});
const branchSchema = z.strictObject({ conditions: conditionSchema, nextEventId: id });
export const choiceSchema = z.strictObject({
  id, text, conditions: conditionSchema.optional(), resultText: text,
  effects: z.array(effectSchema), nextEventId: id.optional(), branches: z.array(branchSchema),
});
export const eventSchema = z.strictObject({
  schemaVersion: version, id, worldIds: ids, entityIds: ids, entityTags: ids,
  stage: z.enum([...STAGES, 'any']), title: text, description: text, image: imagePathSchema,
  weight: positiveWeight, conditions: conditionSchema.optional(),
  chaosWeight: z.number().finite().min(0).max(5).optional(),
  isFallback: z.boolean().optional(), revealsFate: z.boolean().optional(),
  choices: z.array(choiceSchema).min(2).max(3),
  nextEventId: id.optional(), branches: z.array(branchSchema),
});
export const endingSchema = z.strictObject({
  schemaVersion: version, id, worldIds: ids.min(1), title: text, description: text,
  image: imagePathSchema, priority: z.number().int(), isDefault: z.boolean(),
  conditions: conditionSchema.optional(),
});
export const manifestSchema = z.strictObject({
  schemaVersion: version, contentVersion: text,
  worlds: z.array(jsonPath).min(1), entities: z.array(jsonPath).min(1),
  events: z.array(jsonPath), endings: z.array(jsonPath),
});

export type StatKey = z.infer<typeof statKeySchema>;
export type Stats = z.infer<typeof statsSchema>;
export type Stage = z.infer<typeof stageSchema>;
export type BirthOption = z.infer<typeof birthOptionSchema>;
export type BirthEffect = z.infer<typeof birthEffectSchema>;
export type Effect = z.infer<typeof effectSchema>;
export type World = z.infer<typeof worldSchema>;
export type Entity = z.infer<typeof entitySchema>;
export type GameEvent = z.infer<typeof eventSchema>;
export type Choice = z.infer<typeof choiceSchema>;
export type Ending = z.infer<typeof endingSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export interface Content {
  manifest: Manifest;
  worlds: Record<string, World>;
  entities: Record<string, Entity>;
  events: Record<string, GameEvent>;
  endings: Record<string, Ending>;
}

// JSON Schema도 이 공통 정의에서 생성한다.
export const documentSchemas = {
  manifest: manifestSchema, world: worldSchema, entity: entitySchema,
  event: eventSchema, ending: endingSchema,
};
