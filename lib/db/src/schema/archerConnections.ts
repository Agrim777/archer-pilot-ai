import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const archerConnections = pgTable("archer_connections", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  username: text("username").notNull(),
  credential: text("credential").notNull(),
  tenantName: text("tenant_name"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertArcherConnectionSchema = createInsertSchema(archerConnections).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertArcherConnection = z.infer<typeof insertArcherConnectionSchema>;
export type ArcherConnection = typeof archerConnections.$inferSelect;
