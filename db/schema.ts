import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const dismissal = sqliteTable('dismissal', { day: text('day').primaryKey(), revision: integer('revision').notNull(), calls: text('calls').notNull(), requests: text('requests').notNull() });
export const screens = sqliteTable('screens', { id: text('id').primaryKey(), day: text('day').notNull(), revision: integer('revision').notNull(), seen: integer('seen').notNull() });
