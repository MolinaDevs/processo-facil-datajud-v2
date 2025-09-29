import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  processNumber: text("process_number").notNull(),
  tribunal: text("tribunal").notNull(),
  searchedAt: timestamp("searched_at").defaultNow().notNull(),
  resultData: jsonb("result_data"),
});

export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  processNumber: text("process_number").notNull().unique(),
  tribunal: text("tribunal").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  processData: jsonb("process_data").notNull(),
});

export const insertSearchHistorySchema = createInsertSchema(searchHistory).pick({
  processNumber: true,
  tribunal: true,
  resultData: true,
});

export const insertFavoriteSchema = createInsertSchema(favorites).pick({
  processNumber: true,
  tribunal: true,
  processData: true,
});

export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertFavorite = z.infer<typeof insertFavoriteSchema>;
export type Favorite = typeof favorites.$inferSelect;

// Process data types based on busca-processos-judiciais
export const processSearchSchema = z.object({
  processNumber: z.string().min(1, "Número do processo é obrigatório"),
  tribunal: z.string().min(1, "Tribunal é obrigatório"),
});

export type ProcessSearchRequest = z.infer<typeof processSearchSchema>;

export const movementSchema = z.object({
  nome: z.string(),
  dataHora: z.string(),
  complemento: z.string().nullable(),
});

export const subjectSchema = z.object({
  codigo: z.number(),
  nome: z.string(),
});

export const processResultSchema = z.object({
  numeroProcesso: z.string(),
  classeProcessual: z.string(),
  codigoClasseProcessual: z.number(),
  sistemaProcessual: z.string(),
  formatoProcesso: z.string(),
  tribunal: z.string(),
  ultimaAtualizacao: z.string(),
  grau: z.string(),
  dataAjuizamento: z.string(),
  movimentos: z.array(movementSchema),
  orgaoJulgador: z.string(),
  codigoMunicipio: z.number(),
  assuntos: z.array(subjectSchema),
});

export type ProcessResult = z.infer<typeof processResultSchema>;
export type Movement = z.infer<typeof movementSchema>;
export type Subject = z.infer<typeof subjectSchema>;
