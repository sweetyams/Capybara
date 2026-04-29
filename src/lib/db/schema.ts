import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  real,
  integer,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── Projects ──────────────────────────────────────────
export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').default('#6366f1'),
  createdBy: text('created_by').notNull(), // Clerk user ID
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Project Contributors ──────────────────────────────
export const projectContributors = pgTable(
  'project_contributors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    userId: text('user_id').notNull(), // Clerk user ID
    addedAt: timestamp('added_at').defaultNow(),
  },
  (t) => [index('idx_contributors_project').on(t.projectId)],
);

// ─── Sources ───────────────────────────────────────────
export const sources = pgTable(
  'sources',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    type: text('type').notNull(), // 'meeting' | 'doc' | 'slack' | 'other'
    name: text('name').notNull(),
    content: text('content').notNull(),
    summary: text('summary'),
    metadata: jsonb('metadata'), // slack channel, thread id, etc.
    uploadedBy: text('uploaded_by').notNull(),
    status: text('status').default('ready'), // 'processing' | 'ready' | 'failed'
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_sources_project').on(t.projectId)],
);

// ─── Chunks (with pgvector embedding) ──────────────────
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceId: uuid('source_id').notNull().references(() => sources.id),
    content: text('content').notNull(),
    // pgvector column — managed via raw SQL migration since drizzle-orm
    // doesn't have a native vector type. Column: embedding vector(1536)
    metadata: jsonb('metadata'),
    tokenCount: integer('token_count'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_chunks_source').on(t.sourceId)],
);

// ─── Questions ─────────────────────────────────────────
export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    content: text('content').notNull(),
    askedBy: text('asked_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_questions_project').on(t.projectId)],
);

// ─── Drafts ────────────────────────────────────────────
export const drafts = pgTable('drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  content: text('content').notNull(),
  sourcesUsed: jsonb('sources_used'), // chunk IDs array
  confidence: real('confidence'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Rules (learning from feedback) ────────────────────
export const rules = pgTable(
  'rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    condition: text('condition').notNull(),
    behavior: text('behavior').notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_rules_project').on(t.projectId)],
);

// ─── Feedback Events ───────────────────────────────────
export const feedbackEvents = pgTable('feedback_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  draftId: uuid('draft_id').notNull().references(() => drafts.id),
  type: text('type').notNull(), // 'approved' | 'edited' | 'rejected'
  diff: text('diff'),
  userId: text('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Slack Channel Links ───────────────────────────────
export const slackChannels = pgTable(
  'slack_channels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull().references(() => projects.id),
    channelId: text('channel_id').notNull(),
    channelName: text('channel_name'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [index('idx_slack_channel').on(t.channelId)],
);
