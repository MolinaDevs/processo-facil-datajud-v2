// server/app.ts
import express from "express";
import cors from "cors";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  searchHistory;
  favorites;
  follows;
  constructor() {
    this.searchHistory = /* @__PURE__ */ new Map();
    this.favorites = /* @__PURE__ */ new Map();
    this.follows = /* @__PURE__ */ new Map();
  }
  async getSearchHistory() {
    return Array.from(this.searchHistory.values()).sort((a, b) => new Date(b.searchedAt).getTime() - new Date(a.searchedAt).getTime()).slice(0, 10);
  }
  async addSearchHistory(insertSearch) {
    const id = randomUUID();
    const search = {
      ...insertSearch,
      id,
      searchedAt: /* @__PURE__ */ new Date(),
      resultData: insertSearch.resultData || null
    };
    this.searchHistory.set(id, search);
    return search;
  }
  async getFavorites() {
    return Array.from(this.favorites.values()).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }
  async addFavorite(insertFavorite) {
    const id = randomUUID();
    const favorite = {
      ...insertFavorite,
      id,
      addedAt: /* @__PURE__ */ new Date()
    };
    this.favorites.set(insertFavorite.processNumber, favorite);
    return favorite;
  }
  async removeFavorite(processNumber) {
    return this.favorites.delete(processNumber);
  }
  async getFavoriteByProcessNumber(processNumber) {
    return this.favorites.get(processNumber);
  }
  async getFollows() {
    return Array.from(this.follows.values()).sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
  }
  async addFollow(insertFollow) {
    const id = randomUUID();
    const follow = {
      ...insertFollow,
      id,
      addedAt: /* @__PURE__ */ new Date()
    };
    this.follows.set(insertFollow.processNumber, follow);
    return follow;
  }
  async removeFollow(processNumber) {
    return this.follows.delete(processNumber);
  }
  async getFollowByProcessNumber(processNumber) {
    return this.follows.get(processNumber);
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  processNumber: text("process_number").notNull(),
  tribunal: text("tribunal").notNull(),
  searchedAt: timestamp("searched_at").defaultNow().notNull(),
  resultData: jsonb("result_data")
});
var favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  processNumber: text("process_number").notNull().unique(),
  tribunal: text("tribunal").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  processData: jsonb("process_data").notNull()
});
var follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  processNumber: text("process_number").notNull().unique(),
  tribunal: text("tribunal").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  processData: jsonb("process_data").notNull()
});
var insertSearchHistorySchema = createInsertSchema(searchHistory).pick({
  processNumber: true,
  tribunal: true,
  resultData: true
});
var insertFavoriteSchema = createInsertSchema(favorites).pick({
  processNumber: true,
  tribunal: true,
  processData: true
});
var insertFollowSchema = createInsertSchema(follows).pick({
  processNumber: true,
  tribunal: true,
  processData: true
});
var processSearchSchema = z.object({
  processNumber: z.string().min(1, "N\xFAmero do processo \xE9 obrigat\xF3rio"),
  tribunal: z.string().min(1, "Tribunal \xE9 obrigat\xF3rio")
});
var advancedSearchSchema = z.object({
  tribunal: z.string().min(1, "Tribunal \xE9 obrigat\xF3rio"),
  processClass: z.string().optional(),
  judgingBody: z.string().optional(),
  filingDateFrom: z.string().optional(),
  filingDateTo: z.string().optional(),
  searchTerm: z.string().optional()
});
var bulkSearchSchema = z.object({
  tribunal: z.string().min(1, "Tribunal \xE9 obrigat\xF3rio"),
  processNumbers: z.array(z.string().min(1, "N\xFAmero do processo n\xE3o pode estar vazio")).min(1, "Pelo menos um n\xFAmero de processo \xE9 obrigat\xF3rio").max(1e3, "M\xE1ximo de 1000 processos por busca")
});
var tabulatedComplementSchema = z.object({
  codigo: z.coerce.number(),
  valor: z.coerce.number(),
  nome: z.string(),
  descricao: z.string()
});
var movementOrgaoJulgadorSchema = z.object({
  codigoOrgao: z.coerce.number(),
  nomeOrgao: z.string()
});
var movementSchema = z.object({
  codigo: z.coerce.number().optional(),
  nome: z.string(),
  dataHora: z.string(),
  complemento: z.string().nullable().optional(),
  complementosTabelados: z.array(tabulatedComplementSchema).optional(),
  orgaoJulgador: movementOrgaoJulgadorSchema.optional()
});
var subjectSchema = z.object({
  codigo: z.coerce.number(),
  nome: z.string()
});
var processResultSchema = z.object({
  numeroProcesso: z.string(),
  classeProcessual: z.string(),
  codigoClasseProcessual: z.coerce.number(),
  sistemaProcessual: z.string(),
  codigoSistema: z.coerce.number().optional(),
  formatoProcesso: z.string(),
  codigoFormato: z.coerce.number().optional(),
  tribunal: z.string(),
  ultimaAtualizacao: z.string(),
  grau: z.string(),
  dataAjuizamento: z.string(),
  nivelSigilo: z.coerce.number().optional(),
  movimentos: z.array(movementSchema),
  orgaoJulgador: z.string(),
  codigoOrgaoJulgador: z.coerce.number().optional(),
  codigoMunicipio: z.coerce.number().optional(),
  assuntos: z.array(subjectSchema)
});
var bulkSearchResultSchema = z.object({
  processNumber: z.string(),
  result: processResultSchema.nullable(),
  error: z.string().nullable(),
  status: z.enum(["success", "error", "not_found"])
});
var exportRequestSchema = z.object({
  format: z.enum(["pdf", "csv", "json", "excel"]),
  data: z.array(processResultSchema),
  title: z.string().optional(),
  includeMovements: z.boolean().default(true),
  includeSubjects: z.boolean().default(true)
});

// server/routes.ts
import PDFDocument from "pdfkit";
import { stringify } from "csv-stringify/sync";
import * as XLSX from "xlsx";
var DATAJUD_BASE_URL = "https://api-publica.datajud.cnj.jus.br/";
var API_KEY = process.env.DATAJUD_API_KEY;
var isDemoMode = !API_KEY;
var tribunalAliases = {
  // Tribunais Superiores
  stj: "stj",
  stf: "stf",
  tst: "tst",
  tse: "tse",
  stm: "stm",
  // Justiça Federal
  trf1: "trf1",
  trf2: "trf2",
  trf3: "trf3",
  trf4: "trf4",
  trf5: "trf5",
  trf6: "trf6",
  // Justiça Estadual - Major ones
  tjsp: "tjsp",
  tjrj: "tjrj",
  tjmg: "tjmg",
  tjrs: "tjrs",
  tjpr: "tjpr",
  tjsc: "tjsc",
  tjac: "tjac",
  tjal: "tjal",
  tjam: "tjam",
  tjap: "tjap",
  tjba: "tjba",
  tjce: "tjce",
  tjdft: "tjdft",
  tjes: "tjes",
  tjgo: "tjgo",
  tjma: "tjma",
  tjms: "tjms",
  tjmt: "tjmt",
  tjpa: "tjpa",
  tjpb: "tjpb",
  tjpe: "tjpe",
  tjpi: "tjpi",
  tjrn: "tjrn",
  tjro: "tjro",
  tjrr: "tjrr",
  tjse: "tjse",
  tjto: "tjto"
};
async function searchDataJudProcess(tribunal, processNumber) {
  if (isDemoMode) {
    throw new Error("Modo demonstra\xE7\xE3o: Use 'demo-process-123' ou '0000000-00.0000.0.00.0000' para testar");
  }
  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal n\xE3o suportado: ${tribunal}`);
  }
  const url = `${DATAJUD_BASE_URL}api_publica_${tribunalAlias}/_search`;
  const cleanProcessNumber = processNumber.replace(/\D/g, "");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `APIKey ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query: {
        match: {
          numeroProcesso: cleanProcessNumber
        }
      },
      size: 1
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API DataJud: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  if (!data.hits || !data.hits.hits || data.hits.hits.length === 0) {
    throw new Error("Processo n\xE3o encontrado");
  }
  const processData = data.hits.hits[0]._source;
  return {
    numeroProcesso: processData.numeroProcesso || processNumber,
    classeProcessual: processData.classe?.nome || "N\xE3o informado",
    codigoClasseProcessual: processData.classe?.codigo || 0,
    sistemaProcessual: processData.sistema?.nome || processData.sistema || "N\xE3o informado",
    codigoSistema: processData.sistema?.codigo,
    formatoProcesso: processData.formato?.nome || processData.formato || "eletr\xF4nico",
    codigoFormato: processData.formato?.codigo,
    tribunal: tribunal.toUpperCase(),
    ultimaAtualizacao: processData.dataHoraUltimaAtualizacao || processData.dataUltimaAtualizacao || (/* @__PURE__ */ new Date()).toISOString(),
    grau: processData.grau || "N\xE3o informado",
    dataAjuizamento: processData.dataAjuizamento || "N\xE3o informado",
    nivelSigilo: processData.nivelSigilo,
    movimentos: processData.movimentos || [],
    orgaoJulgador: processData.orgaoJulgador?.nome || "N\xE3o informado",
    codigoOrgaoJulgador: processData.orgaoJulgador?.codigo,
    codigoMunicipio: processData.orgaoJulgador?.codigoMunicipioIBGE,
    assuntos: processData.assuntos || []
  };
}
async function advancedSearchDataJud(searchParams) {
  const { tribunal, processClass, judgingBody, filingDateFrom, filingDateTo, searchTerm } = searchParams;
  if (isDemoMode) {
    throw new Error("Modo demonstra\xE7\xE3o: Use 'demo-process-123' ou 'demo' no campo de busca para testar");
  }
  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal n\xE3o suportado: ${tribunal}`);
  }
  const url = `${DATAJUD_BASE_URL}api_publica_${tribunalAlias}/_search`;
  const query = {
    bool: {
      must: []
    }
  };
  if (processClass) {
    query.bool.must.push({
      match: {
        "classe.nome": processClass
      }
    });
  }
  if (judgingBody) {
    query.bool.must.push({
      match: {
        "orgaoJulgador.nome": judgingBody
      }
    });
  }
  if (filingDateFrom || filingDateTo) {
    const dateRange = {};
    if (filingDateFrom) dateRange.gte = filingDateFrom;
    if (filingDateTo) dateRange.lte = filingDateTo;
    query.bool.must.push({
      range: {
        dataAjuizamento: dateRange
      }
    });
  }
  if (searchTerm) {
    query.bool.must.push({
      multi_match: {
        query: searchTerm,
        fields: ["classe.nome", "orgaoJulgador.nome", "assuntos.nome"]
      }
    });
  }
  if (query.bool.must.length === 0) {
    throw new Error("\xC9 necess\xE1rio especificar pelo menos um filtro de busca");
  }
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `APIKey ${API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      query,
      size: 20,
      // Return more results for advanced search
      sort: [{ dataAjuizamento: { order: "desc" } }]
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erro na API DataJud: ${response.status} - ${errorText}`);
  }
  const data = await response.json();
  if (!data.hits || !data.hits.hits || data.hits.hits.length === 0) {
    throw new Error("Nenhum processo encontrado com os filtros especificados");
  }
  return data.hits.hits.map((hit) => {
    const processData = hit._source;
    return {
      numeroProcesso: processData.numeroProcesso || "N\xE3o informado",
      classeProcessual: processData.classe?.nome || "N\xE3o informado",
      codigoClasseProcessual: processData.classe?.codigo || 0,
      sistemaProcessual: processData.sistema?.nome || processData.sistema || "N\xE3o informado",
      codigoSistema: processData.sistema?.codigo,
      formatoProcesso: processData.formato?.nome || processData.formato || "eletr\xF4nico",
      codigoFormato: processData.formato?.codigo,
      tribunal: tribunal.toUpperCase(),
      ultimaAtualizacao: processData.dataHoraUltimaAtualizacao || processData.dataUltimaAtualizacao || (/* @__PURE__ */ new Date()).toISOString(),
      grau: processData.grau || "N\xE3o informado",
      dataAjuizamento: processData.dataAjuizamento || "N\xE3o informado",
      nivelSigilo: processData.nivelSigilo,
      movimentos: processData.movimentos || [],
      orgaoJulgador: processData.orgaoJulgador?.nome || "N\xE3o informado",
      codigoOrgaoJulgador: processData.orgaoJulgador?.codigo,
      codigoMunicipio: processData.orgaoJulgador?.codigoMunicipioIBGE,
      assuntos: processData.assuntos || []
    };
  });
}
async function bulkSearchDataJud(tribunal, processNumbers) {
  const tribunalAlias = tribunalAliases[tribunal.toLowerCase()];
  if (!tribunalAlias) {
    throw new Error(`Tribunal n\xE3o suportado: ${tribunal}`);
  }
  const results = [];
  const batchSize = 10;
  for (let i = 0; i < processNumbers.length; i += batchSize) {
    const batch = processNumbers.slice(i, i + batchSize);
    const batchPromises = batch.map(async (processNumber) => {
      try {
        if (processNumber === "0000000-00.0000.0.00.0000" || processNumber === "demo-process-123" || processNumber.includes("demo")) {
          return {
            processNumber,
            result: {
              numeroProcesso: processNumber,
              classeProcessual: "A\xE7\xE3o Civil P\xFAblica (Demo)",
              codigoClasseProcessual: 12729,
              sistemaProcessual: "PJe",
              codigoSistema: 3,
              formatoProcesso: "eletr\xF4nico",
              codigoFormato: 1,
              tribunal: tribunal.toUpperCase(),
              ultimaAtualizacao: (/* @__PURE__ */ new Date()).toISOString(),
              grau: "1\xBA Grau",
              dataAjuizamento: "2023-01-15T00:00:00Z",
              nivelSigilo: 0,
              movimentos: [
                {
                  codigo: 26,
                  nome: "Distribui\xE7\xE3o",
                  dataHora: "2023-01-15T10:00:00Z",
                  complemento: "Processo distribu\xEDdo para an\xE1lise",
                  complementosTabelados: [
                    {
                      codigo: 2,
                      valor: 1,
                      nome: "compet\xEAncia exclusiva",
                      descricao: "tipo_de_distribuicao_redistribuicao"
                    }
                  ]
                }
              ],
              orgaoJulgador: "1\xAA Vara C\xEDvel",
              codigoOrgaoJulgador: 9700,
              codigoMunicipio: 3550308,
              assuntos: [
                { codigo: 10518, nome: "Responsabilidade Civil" }
              ]
            },
            error: null,
            status: "success"
          };
        }
        const result = await searchDataJudProcess(tribunal, processNumber);
        return {
          processNumber,
          result,
          error: null,
          status: "success"
        };
      } catch (error) {
        return {
          processNumber,
          result: null,
          error: error instanceof Error ? error.message : "Erro desconhecido",
          status: error instanceof Error && error.message === "Processo n\xE3o encontrado" ? "not_found" : "error"
        };
      }
    });
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    if (i + batchSize < processNumbers.length) {
      await new Promise((resolve) => setTimeout(resolve, 1e3));
    }
  }
  return results;
}
function formatDateSafely(dateValue, format = "date") {
  if (!dateValue) return "";
  const sentinelValues = ["N\xE3o informado", "N/A", "n/a", "n\xE3o dispon\xEDvel"];
  if (typeof dateValue === "string" && sentinelValues.some((s) => dateValue.toLowerCase() === s.toLowerCase())) {
    return dateValue;
  }
  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      return typeof dateValue === "string" ? dateValue : "";
    }
    if (format === "date") {
      return date.toLocaleDateString("pt-BR");
    } else if (format === "time") {
      return date.toLocaleTimeString("pt-BR");
    } else {
      return `${date.toLocaleDateString("pt-BR")} ${date.toLocaleTimeString("pt-BR")}`;
    }
  } catch {
    return typeof dateValue === "string" ? dateValue : "";
  }
}
async function generatePDF(processes, title = "Relat\xF3rio de Processos", includeMovements = true, includeSubjects = true) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      size: "A4"
    });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);
    try {
      doc.fontSize(16).font("Helvetica-Bold").text(title, { align: "center" });
      doc.fontSize(10).text(`Gerado em: ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR")}`, { align: "center" });
      doc.moveDown(2);
      processes.forEach((process2, index) => {
        if (index > 0) {
          doc.addPage();
        }
        doc.fontSize(14).font("Helvetica-Bold").text(`Processo: ${process2.numeroProcesso}`);
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica");
        doc.text(`Classe Processual: ${process2.classeProcessual}`);
        doc.text(`Tribunal: ${process2.tribunal}`);
        doc.text(`\xD3rg\xE3o Julgador: ${process2.orgaoJulgador}`);
        doc.text(`Grau: ${process2.grau}`);
        doc.text(`Sistema: ${process2.sistemaProcessual} (${process2.formatoProcesso})`);
        doc.text(`Data de Ajuizamento: ${formatDateSafely(process2.dataAjuizamento)}`);
        doc.text(`\xDAltima Atualiza\xE7\xE3o: ${formatDateSafely(process2.ultimaAtualizacao)}`);
        doc.moveDown(1);
        if (includeSubjects && process2.assuntos && process2.assuntos.length > 0) {
          doc.fontSize(12).font("Helvetica-Bold").text("Assuntos:");
          doc.fontSize(10).font("Helvetica");
          process2.assuntos.forEach((subject) => {
            doc.text(`\u2022 ${subject.nome} (${subject.codigo})`);
          });
          doc.moveDown(1);
        }
        if (includeMovements && process2.movimentos && process2.movimentos.length > 0) {
          doc.fontSize(12).font("Helvetica-Bold").text("Movimenta\xE7\xF5es:");
          doc.fontSize(10).font("Helvetica");
          process2.movimentos.forEach((movement) => {
            const date = formatDateSafely(movement.dataHora, "date");
            const time = formatDateSafely(movement.dataHora, "time");
            doc.text(`\u2022 ${date} ${time} - ${movement.nome}`);
            if (movement.complemento) {
              doc.text(`  ${movement.complemento}`);
            }
          });
        }
      });
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
function generateCSV(processes, includeMovements = true, includeSubjects = true) {
  const records = [];
  processes.forEach((process2) => {
    const record = {
      "N\xFAmero do Processo": process2.numeroProcesso,
      "Classe Processual": process2.classeProcessual,
      "C\xF3digo Classe": process2.codigoClasseProcessual,
      "Tribunal": process2.tribunal,
      "\xD3rg\xE3o Julgador": process2.orgaoJulgador,
      "Grau": process2.grau,
      "Sistema": process2.sistemaProcessual,
      "Formato": process2.formatoProcesso,
      "Data de Ajuizamento": formatDateSafely(process2.dataAjuizamento),
      "\xDAltima Atualiza\xE7\xE3o": formatDateSafely(process2.ultimaAtualizacao)
    };
    if (includeSubjects && process2.assuntos && process2.assuntos.length > 0) {
      record["Assuntos"] = process2.assuntos.map((s) => s.nome).join("; ");
      record["C\xF3digos dos Assuntos"] = process2.assuntos.map((s) => s.codigo).join("; ");
    } else {
      record["Assuntos"] = "";
      record["C\xF3digos dos Assuntos"] = "";
    }
    if (includeMovements && process2.movimentos && process2.movimentos.length > 0) {
      record["Total de Movimenta\xE7\xF5es"] = process2.movimentos.length;
      record["\xDAltima Movimenta\xE7\xE3o"] = process2.movimentos[0]?.nome || "";
      record["Data \xDAltima Movimenta\xE7\xE3o"] = formatDateSafely(process2.movimentos[0]?.dataHora);
      const movementsText = process2.movimentos.map((mov, idx) => {
        const date = formatDateSafely(mov.dataHora, "date");
        const time = formatDateSafely(mov.dataHora, "time");
        return `[${idx + 1}] ${date} ${time} - ${mov.nome}${mov.complemento ? " | " + mov.complemento : ""}`;
      }).join(" || ");
      record["Hist\xF3rico Completo de Movimenta\xE7\xF5es"] = movementsText;
    } else {
      record["Total de Movimenta\xE7\xF5es"] = 0;
      record["\xDAltima Movimenta\xE7\xE3o"] = "";
      record["Data \xDAltima Movimenta\xE7\xE3o"] = "";
      record["Hist\xF3rico Completo de Movimenta\xE7\xF5es"] = "";
    }
    records.push(record);
  });
  return stringify(records, {
    header: true,
    delimiter: ",",
    quoted: true,
    quoted_empty: true,
    bom: true
  });
}
function generateJSON(processes, includeMovements = true, includeSubjects = true) {
  const filteredProcesses = processes.map((process2) => {
    const filtered = {
      numeroProcesso: process2.numeroProcesso,
      classeProcessual: process2.classeProcessual,
      tribunal: process2.tribunal,
      orgaoJulgador: process2.orgaoJulgador,
      grau: process2.grau,
      sistemaProcessual: process2.sistemaProcessual,
      formatoProcesso: process2.formatoProcesso,
      dataAjuizamento: process2.dataAjuizamento,
      ultimaAtualizacao: process2.ultimaAtualizacao
    };
    if (includeSubjects) {
      filtered.assuntos = process2.assuntos;
    }
    if (includeMovements) {
      filtered.movimentos = process2.movimentos;
    }
    return filtered;
  });
  return JSON.stringify({
    metadata: {
      geradoEm: (/* @__PURE__ */ new Date()).toISOString(),
      totalProcessos: processes.length,
      includeMovimentos: includeMovements,
      includeAssuntos: includeSubjects
    },
    processos: filteredProcesses
  }, null, 2);
}
function generateExcel(processes, includeMovements = true, includeSubjects = true) {
  const workbook = XLSX.utils.book_new();
  const mainData = [];
  processes.forEach((process2) => {
    const row = {
      "N\xFAmero do Processo": process2.numeroProcesso,
      "Classe Processual": process2.classeProcessual,
      "C\xF3digo Classe": process2.codigoClasseProcessual,
      "Tribunal": process2.tribunal,
      "\xD3rg\xE3o Julgador": process2.orgaoJulgador,
      "C\xF3digo \xD3rg\xE3o Julgador": process2.codigoOrgaoJulgador || "",
      "Grau": process2.grau,
      "Sistema": process2.sistemaProcessual,
      "C\xF3digo Sistema": process2.codigoSistema || "",
      "Formato": process2.formatoProcesso,
      "C\xF3digo Formato": process2.codigoFormato || "",
      "Data de Ajuizamento": formatDateSafely(process2.dataAjuizamento),
      "\xDAltima Atualiza\xE7\xE3o": formatDateSafely(process2.ultimaAtualizacao),
      "N\xEDvel de Sigilo": process2.nivelSigilo || "",
      "C\xF3digo Munic\xEDpio": process2.codigoMunicipio || ""
    };
    if (includeSubjects) {
      row["Assuntos"] = process2.assuntos.map((s) => `${s.nome} (${s.codigo})`).join("; ");
      row["C\xF3digos Assuntos"] = process2.assuntos.map((s) => s.codigo).join("; ");
    }
    row["Quantidade de Movimentos"] = process2.movimentos.length;
    mainData.push(row);
  });
  const mainSheet = XLSX.utils.json_to_sheet(mainData);
  const wscols = [
    { wch: 25 },
    // Número do Processo
    { wch: 30 },
    // Classe Processual
    { wch: 15 },
    // Código Classe
    { wch: 15 },
    // Tribunal
    { wch: 30 },
    // Órgão Julgador
    { wch: 20 },
    // Código Órgão
    { wch: 10 },
    // Grau
    { wch: 15 },
    // Sistema
    { wch: 15 },
    // Código Sistema
    { wch: 15 },
    // Formato
    { wch: 15 },
    // Código Formato
    { wch: 18 },
    // Data Ajuizamento
    { wch: 18 },
    // Última Atualização
    { wch: 15 },
    // Nível Sigilo
    { wch: 15 },
    // Código Município
    { wch: 50 },
    // Assuntos
    { wch: 30 },
    // Códigos Assuntos
    { wch: 22 }
    // Quantidade Movimentos
  ];
  mainSheet["!cols"] = wscols;
  XLSX.utils.book_append_sheet(workbook, mainSheet, "Processos");
  if (includeMovements) {
    const movementsData = [];
    processes.forEach((process2) => {
      process2.movimentos.forEach((movement, index) => {
        const movRow = {
          "N\xFAmero do Processo": process2.numeroProcesso,
          "Sequ\xEAncia": index + 1,
          "Data": formatDateSafely(movement.dataHora, "date"),
          "Hora": formatDateSafely(movement.dataHora, "time"),
          "C\xF3digo Movimento": movement.codigo || "",
          "Nome do Movimento": movement.nome,
          "Complemento": movement.complemento || ""
        };
        if (movement.orgaoJulgador) {
          movRow["\xD3rg\xE3o Julgador Movimento"] = movement.orgaoJulgador.nomeOrgao;
          movRow["C\xF3digo \xD3rg\xE3o Movimento"] = movement.orgaoJulgador.codigoOrgao;
        }
        if (movement.complementosTabelados && movement.complementosTabelados.length > 0) {
          movRow["Complementos Tabelados"] = movement.complementosTabelados.map((c) => `${c.nome}: ${c.descricao} (${c.codigo}=${c.valor})`).join("; ");
        }
        movementsData.push(movRow);
      });
    });
    if (movementsData.length > 0) {
      const movSheet = XLSX.utils.json_to_sheet(movementsData);
      const movWscols = [
        { wch: 25 },
        // Número do Processo
        { wch: 10 },
        // Sequência
        { wch: 12 },
        // Data
        { wch: 10 },
        // Hora
        { wch: 18 },
        // Código Movimento
        { wch: 40 },
        // Nome do Movimento
        { wch: 50 },
        // Complemento
        { wch: 30 },
        // Órgão Julgador Movimento
        { wch: 20 },
        // Código Órgão Movimento
        { wch: 60 }
        // Complementos Tabelados
      ];
      movSheet["!cols"] = movWscols;
      XLSX.utils.book_append_sheet(workbook, movSheet, "Movimenta\xE7\xF5es");
    }
  }
  if (includeSubjects) {
    const subjectsData = [];
    processes.forEach((process2) => {
      process2.assuntos.forEach((subject) => {
        subjectsData.push({
          "N\xFAmero do Processo": process2.numeroProcesso,
          "C\xF3digo Assunto": subject.codigo,
          "Nome do Assunto": subject.nome
        });
      });
    });
    if (subjectsData.length > 0) {
      const subjSheet = XLSX.utils.json_to_sheet(subjectsData);
      const subjWscols = [
        { wch: 25 },
        // Número do Processo
        { wch: 15 },
        // Código Assunto
        { wch: 50 }
        // Nome do Assunto
      ];
      subjSheet["!cols"] = subjWscols;
      XLSX.utils.book_append_sheet(workbook, subjSheet, "Assuntos");
    }
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
async function registerRoutes(app2) {
  app2.post("/api/search-process", async (req, res) => {
    try {
      const { processNumber, tribunal } = processSearchSchema.parse(req.body);
      if (processNumber === "0000000-00.0000.0.00.0000" || processNumber === "demo-process-123") {
        const demoResult = {
          numeroProcesso: processNumber,
          classeProcessual: "A\xE7\xE3o Civil P\xFAblica",
          codigoClasseProcessual: 12729,
          sistemaProcessual: "PJe",
          codigoSistema: 3,
          formatoProcesso: "eletr\xF4nico",
          codigoFormato: 1,
          tribunal: tribunal.toUpperCase(),
          ultimaAtualizacao: (/* @__PURE__ */ new Date()).toISOString(),
          grau: "1\xBA Grau",
          dataAjuizamento: "2023-01-15T00:00:00Z",
          nivelSigilo: 0,
          movimentos: [
            {
              codigo: 26,
              nome: "Distribui\xE7\xE3o",
              dataHora: "2023-01-15T10:00:00Z",
              complemento: "Processo distribu\xEDdo para an\xE1lise",
              complementosTabelados: [
                {
                  codigo: 2,
                  valor: 1,
                  nome: "compet\xEAncia exclusiva",
                  descricao: "tipo_de_distribuicao_redistribuicao"
                }
              ]
            },
            {
              codigo: 193,
              nome: "Cita\xE7\xE3o",
              dataHora: "2023-02-01T14:30:00Z",
              complemento: "Cita\xE7\xE3o realizada com sucesso"
            },
            {
              codigo: 970,
              nome: "Audi\xEAncia de Concilia\xE7\xE3o",
              dataHora: "2023-03-15T09:00:00Z",
              complemento: "Audi\xEAncia realizada - sem acordo"
            }
          ],
          orgaoJulgador: "1\xAA Vara C\xEDvel",
          codigoOrgaoJulgador: 9700,
          codigoMunicipio: 3550308,
          assuntos: [
            { codigo: 10518, nome: "Responsabilidade Civil" },
            { codigo: 10520, nome: "Dano Material" }
          ]
        };
        await storage.addSearchHistory({
          processNumber,
          tribunal,
          resultData: demoResult
        });
        return res.json({ success: true, data: demoResult });
      }
      const result = await searchDataJudProcess(tribunal, processNumber);
      await storage.addSearchHistory({
        processNumber,
        tribunal,
        resultData: result
      });
      res.json({ success: true, data: result });
    } catch (error) {
      const { processNumber, tribunal } = req.body;
      if (processNumber && tribunal) {
        await storage.addSearchHistory({
          processNumber,
          tribunal,
          resultData: null
        });
      }
      console.error("Search process error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro na busca do processo"
      });
    }
  });
  app2.post("/api/advanced-search", async (req, res) => {
    try {
      const searchParams = advancedSearchSchema.parse(req.body);
      if (searchParams.processClass === "Demo" || searchParams.searchTerm === "demo" || searchParams.searchTerm === "demo-process-123" || searchParams.searchTerm === "0000000-00.0000.0.00.0000") {
        const demoResults = [
          {
            numeroProcesso: "1234567-89.2023.8.26.0001",
            classeProcessual: "A\xE7\xE3o de Cobran\xE7a",
            codigoClasseProcessual: 10234,
            sistemaProcessual: "PJe",
            codigoSistema: 3,
            formatoProcesso: "eletr\xF4nico",
            codigoFormato: 1,
            tribunal: searchParams.tribunal.toUpperCase(),
            ultimaAtualizacao: (/* @__PURE__ */ new Date()).toISOString(),
            grau: "1\xBA Grau",
            dataAjuizamento: "2023-01-15T00:00:00Z",
            nivelSigilo: 0,
            movimentos: [
              {
                codigo: 26,
                nome: "Distribui\xE7\xE3o",
                dataHora: "2023-01-15T10:00:00Z",
                complemento: "Processo distribu\xEDdo"
              }
            ],
            orgaoJulgador: "2\xAA Vara C\xEDvel",
            codigoOrgaoJulgador: 9701,
            codigoMunicipio: 3550308,
            assuntos: [
              { codigo: 10518, nome: "Cobran\xE7a de D\xEDvida" }
            ]
          },
          {
            numeroProcesso: "2345678-90.2023.8.26.0002",
            classeProcessual: "A\xE7\xE3o de Cobran\xE7a",
            codigoClasseProcessual: 10234,
            sistemaProcessual: "PJe",
            codigoSistema: 3,
            formatoProcesso: "eletr\xF4nico",
            codigoFormato: 1,
            tribunal: searchParams.tribunal.toUpperCase(),
            ultimaAtualizacao: (/* @__PURE__ */ new Date()).toISOString(),
            grau: "1\xBA Grau",
            dataAjuizamento: "2023-02-10T00:00:00Z",
            nivelSigilo: 0,
            movimentos: [
              {
                codigo: 26,
                nome: "Distribui\xE7\xE3o",
                dataHora: "2023-02-10T09:00:00Z",
                complemento: "Processo distribu\xEDdo"
              }
            ],
            orgaoJulgador: "3\xAA Vara C\xEDvel",
            codigoOrgaoJulgador: 9702,
            codigoMunicipio: 3550308,
            assuntos: [
              { codigo: 10518, nome: "Cobran\xE7a de D\xEDvida" }
            ]
          }
        ];
        for (const result of demoResults) {
          await storage.addSearchHistory({
            processNumber: result.numeroProcesso,
            tribunal: searchParams.tribunal,
            resultData: result
          });
        }
        return res.json({ success: true, data: demoResults });
      }
      const results = await advancedSearchDataJud(searchParams);
      if (results.length > 0) {
        await storage.addSearchHistory({
          processNumber: results[0].numeroProcesso,
          tribunal: searchParams.tribunal,
          resultData: results[0]
        });
      }
      res.json({ success: true, data: results });
    } catch (error) {
      console.error("Advanced search error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro na busca avan\xE7ada"
      });
    }
  });
  app2.post("/api/bulk-search", async (req, res) => {
    try {
      const { tribunal, processNumbers } = bulkSearchSchema.parse(req.body);
      const isDemoMode2 = processNumbers.some(
        (num) => num.includes("demo") || num === "0000000-00.0000.0.00.0000" || num === "demo-process-123"
      );
      if (isDemoMode2) {
        const demoResults = processNumbers.map((processNumber, index) => ({
          processNumber,
          result: {
            numeroProcesso: processNumber,
            classeProcessual: `A\xE7\xE3o Civil P\xFAblica (Demo ${index + 1})`,
            codigoClasseProcessual: 12729,
            sistemaProcessual: "PJe",
            codigoSistema: 3,
            formatoProcesso: "eletr\xF4nico",
            codigoFormato: 1,
            tribunal: tribunal.toUpperCase(),
            ultimaAtualizacao: (/* @__PURE__ */ new Date()).toISOString(),
            grau: "1\xBA Grau",
            dataAjuizamento: new Date(2023, 0, 15 + index).toISOString(),
            nivelSigilo: 0,
            movimentos: [
              {
                codigo: 26,
                nome: "Distribui\xE7\xE3o",
                dataHora: new Date(2023, 0, 15 + index, 10, 0, 0).toISOString(),
                complemento: `Processo distribu\xEDdo para an\xE1lise - Demo ${index + 1}`
              }
            ],
            orgaoJulgador: `${index + 1}\xAA Vara C\xEDvel`,
            codigoOrgaoJulgador: 9700 + index,
            codigoMunicipio: 3550308,
            assuntos: [
              { codigo: 10518, nome: "Responsabilidade Civil" }
            ]
          },
          error: null,
          status: "success"
        }));
        for (const result of demoResults) {
          if (result.status === "success" && result.result) {
            await storage.addSearchHistory({
              processNumber: result.processNumber,
              tribunal,
              resultData: result.result
            });
          }
        }
        return res.json({ success: true, data: demoResults });
      }
      const results = await bulkSearchDataJud(tribunal, processNumbers);
      for (const result of results) {
        if (result.status === "success" && result.result) {
          await storage.addSearchHistory({
            processNumber: result.processNumber,
            tribunal,
            resultData: result.result
          });
        }
      }
      res.json({ success: true, data: results });
    } catch (error) {
      console.error("Bulk search error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro na busca em lote"
      });
    }
  });
  app2.post("/api/export", async (req, res) => {
    try {
      const { format, data, title, includeMovements, includeSubjects } = exportRequestSchema.parse(req.body);
      if (!data || data.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Nenhum dado fornecido para exporta\xE7\xE3o"
        });
      }
      const filename = `processos_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
      switch (format) {
        case "pdf":
          const pdfBuffer = await generatePDF(data, title, includeMovements, includeSubjects);
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
          res.send(pdfBuffer);
          break;
        case "csv":
          const csvContent = generateCSV(data, includeMovements, includeSubjects);
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
          res.send(csvContent);
          break;
        case "excel":
          const excelBuffer = generateExcel(data, includeMovements, includeSubjects);
          res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
          res.send(excelBuffer);
          break;
        case "json":
          const jsonContent = generateJSON(data, includeMovements, includeSubjects);
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}.json"`);
          res.send(jsonContent);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: "Formato de exporta\xE7\xE3o n\xE3o suportado"
          });
      }
    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro na exporta\xE7\xE3o de dados"
      });
    }
  });
  app2.get("/api/search-history", async (req, res) => {
    try {
      const history = await storage.getSearchHistory();
      res.json({ success: true, data: history });
    } catch (error) {
      console.error("Get search history error:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao carregar hist\xF3rico"
      });
    }
  });
  app2.get("/api/favorites", async (req, res) => {
    try {
      const favorites2 = await storage.getFavorites();
      res.json({ success: true, data: favorites2 });
    } catch (error) {
      console.error("Get favorites error:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao carregar favoritos"
      });
    }
  });
  app2.post("/api/favorites", async (req, res) => {
    try {
      const favoriteData = insertFavoriteSchema.parse(req.body);
      const existing = await storage.getFavoriteByProcessNumber(favoriteData.processNumber);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: "Processo j\xE1 est\xE1 nos favoritos"
        });
      }
      const favorite = await storage.addFavorite(favoriteData);
      res.json({ success: true, data: favorite });
    } catch (error) {
      console.error("Add favorite error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro ao adicionar favorito"
      });
    }
  });
  app2.delete("/api/favorites/:processNumber", async (req, res) => {
    try {
      const { processNumber } = req.params;
      const removed = await storage.removeFavorite(processNumber);
      if (!removed) {
        return res.status(404).json({
          success: false,
          error: "Favorito n\xE3o encontrado"
        });
      }
      res.json({ success: true, message: "Favorito removido" });
    } catch (error) {
      console.error("Remove favorite error:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao remover favorito"
      });
    }
  });
  app2.get("/api/follows", async (req, res) => {
    try {
      const follows2 = await storage.getFollows();
      res.json({ success: true, data: follows2 });
    } catch (error) {
      console.error("Get follows error:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao carregar acompanhamentos"
      });
    }
  });
  app2.post("/api/follows", async (req, res) => {
    try {
      const followData = insertFollowSchema.parse(req.body);
      const existing = await storage.getFollowByProcessNumber(followData.processNumber);
      if (existing) {
        return res.status(400).json({
          success: false,
          error: "Processo j\xE1 est\xE1 sendo acompanhado"
        });
      }
      const follow = await storage.addFollow(followData);
      res.json({ success: true, data: follow });
    } catch (error) {
      console.error("Add follow error:", error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Erro ao adicionar acompanhamento"
      });
    }
  });
  app2.delete("/api/follows/:processNumber", async (req, res) => {
    try {
      const { processNumber } = req.params;
      const removed = await storage.removeFollow(processNumber);
      if (!removed) {
        return res.status(404).json({
          success: false,
          error: "Acompanhamento n\xE3o encontrado"
        });
      }
      res.json({ success: true, message: "Acompanhamento removido" });
    } catch (error) {
      console.error("Remove follow error:", error);
      res.status(500).json({
        success: false,
        error: "Erro ao remover acompanhamento"
      });
    }
  });
  app2.get("/api/tribunals", (req, res) => {
    const tribunals = [
      {
        category: "Tribunais Superiores",
        items: [
          { value: "stj", label: "STJ - Superior Tribunal de Justi\xE7a" },
          { value: "stf", label: "STF - Supremo Tribunal Federal" },
          { value: "tst", label: "TST - Tribunal Superior do Trabalho" },
          { value: "tse", label: "TSE - Tribunal Superior Eleitoral" },
          { value: "stm", label: "STM - Superior Tribunal Militar" }
        ]
      },
      {
        category: "Justi\xE7a Federal",
        items: [
          { value: "trf1", label: "TRF1 - Tribunal Regional Federal da 1\xAA Regi\xE3o" },
          { value: "trf2", label: "TRF2 - Tribunal Regional Federal da 2\xAA Regi\xE3o" },
          { value: "trf3", label: "TRF3 - Tribunal Regional Federal da 3\xAA Regi\xE3o" },
          { value: "trf4", label: "TRF4 - Tribunal Regional Federal da 4\xAA Regi\xE3o" },
          { value: "trf5", label: "TRF5 - Tribunal Regional Federal da 5\xAA Regi\xE3o" },
          { value: "trf6", label: "TRF6 - Tribunal Regional Federal da 6\xAA Regi\xE3o" }
        ]
      },
      {
        category: "Justi\xE7a Estadual",
        items: [
          { value: "tjsp", label: "TJSP - Tribunal de Justi\xE7a de S\xE3o Paulo" },
          { value: "tjrj", label: "TJRJ - Tribunal de Justi\xE7a do Rio de Janeiro" },
          { value: "tjmg", label: "TJMG - Tribunal de Justi\xE7a de Minas Gerais" },
          { value: "tjrs", label: "TJRS - Tribunal de Justi\xE7a do Rio Grande do Sul" },
          { value: "tjpr", label: "TJPR - Tribunal de Justi\xE7a do Paran\xE1" },
          { value: "tjsc", label: "TJSC - Tribunal de Justi\xE7a de Santa Catarina" },
          { value: "tjba", label: "TJBA - Tribunal de Justi\xE7a da Bahia" },
          { value: "tjgo", label: "TJGO - Tribunal de Justi\xE7a de Goi\xE1s" },
          { value: "tjce", label: "TJCE - Tribunal de Justi\xE7a do Cear\xE1" },
          { value: "tjpe", label: "TJPE - Tribunal de Justi\xE7a de Pernambuco" }
        ]
      }
    ];
    res.json({ success: true, data: tribunals });
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/app.ts
var app = express();
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));
registerRoutes(app);
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});
var app_default = app;

// api/index.ts
function handler(req, res) {
  return app_default(req, res);
}
var config = {
  api: {
    bodyParser: false
  }
};
export {
  config,
  handler as default
};
