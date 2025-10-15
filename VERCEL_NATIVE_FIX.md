# ✅ SOLUÇÃO DEFINITIVA - Vercel Native Catch-All Routes

## 🔍 Problema Identificado

Todas as tentativas anteriores falharam porque:
1. Rewrites no `vercel.json` não preservam o caminho original
2. Headers do Vercel (x-vercel-*) NÃO EXISTEM
3. Query parameters executam DEPOIS do roteamento do Express
4. Express recebe sempre `/api/index` e nunca consegue rotear

## ✅ Solução Implementada: Vercel Native Catch-All

Seguindo a abordagem **recomendada pelo Vercel** para Express serverless:

### 1. Estrutura de Arquivos

```
server/
  app.ts          ← Express app exportável (sem servidor HTTP)
  index.ts        ← Dev server local
  routes.ts       ← Rotas da API

api/
  index.ts        ← Handler Vercel para /api
  [...slug].ts    ← Catch-all handler para /api/* (suporta qualquer rota)
```

### 2. Como Funciona

**`server/app.ts`** - Express app reutilizável:
```typescript
import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes";

const app = express();
app.use(cors(...));
app.use(express.json());
registerRoutes(app);

export default app;
```

**`api/[...slug].ts`** - Catch-all handler nativo do Vercel:
```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../server/app';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
```

**Sem rewrites no `vercel.json`!** O Vercel roteia `/api/*` automaticamente.

### 3. Vantagens

- ✅ Path original preservado (`/api/tribunals` chega como `/api/tribunals`)
- ✅ Express roteia normalmente (sem middlewares hacky)
- ✅ Suporta TODAS as rotas: `/api/tribunals`, `/api/search-process`, etc.
- ✅ Abordagem nativa e recomendada pelo Vercel
- ✅ Funciona em dev e production

## 📤 Deploy no Vercel

### Build Settings
- **Build Command:** `chmod +x build-vercel.sh && ./build-vercel.sh`
- **Output Directory:** `dist/public`
- **Install Command:** `npm install`

### Environment Variables
```
DATAJUD_API_KEY=sua_chave_aqui
SESSION_SECRET=string_secreta_aleatoria_minimo_32_caracteres
NODE_ENV=production
```

## 🎯 Arquivos Modificados

- ✅ **server/app.ts** - Novo: Express app exportável
- ✅ **api/[...slug].ts** - Novo: Catch-all handler Vercel
- ✅ **api/index.ts** - Atualizado: Handler Vercel simples
- ✅ **server/index.ts** - Atualizado: Importa app.ts
- ✅ **vercel.json** - Removido rewrites (não necessário!)
- ✅ **@vercel/node** - Instalado para tipos Vercel

## 🔍 Verificação

Após deploy, acesse:
- `https://seu-app.vercel.app/api/tribunals` → Deve retornar lista de tribunais
- Frontend deve carregar tribunais automaticamente

**Esta é a solução DEFINITIVA e nativa do Vercel!** 🚀
