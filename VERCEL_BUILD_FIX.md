# 🔧 Fix para Deploy no Vercel - Tribunais Não Aparecem

## Problema Identificado

O arquivo `api/index.ts` não estava sendo compilado para JavaScript, causando erro nas funções serverless do Vercel.

## ✅ Solução Aplicada

### 1. Arquivo de Build Criado

Foi criado o arquivo `build-vercel.sh` que compila corretamente:
- Frontend: `vite build` → `dist/public`
- API serverless: `esbuild api/index.ts` → `api/index.js`

### 2. TypeScript Nativo no Vercel

O Vercel compila automaticamente arquivos `.ts` em serverless functions, então mantemos apenas `api/index.ts`.

## 📤 Passos para Deploy

### 1. Dar permissão ao script

```bash
chmod +x build-vercel.sh
```

### 2. Adicionar arquivos ao Git

```bash
# Adicionar o build script
git add build-vercel.sh

# Remover api/index.js (causa conflito)
git rm api/index.js

# Adicionar arquivos atualizados
git add api/index.ts VERCEL_BUILD_FIX.md vercel.json
```

### 3. Fazer commit

```bash
git commit -m "fix: Corrigir build serverless para Vercel - adicionar api/index.js compilado"
```

### 4. Push para GitHub

```bash
git push origin main
```

## ⚙️ Configuração no Vercel

Ao fazer o deploy no Vercel, use estas configurações:

### Build Settings
- **Build Command:** `./build-vercel.sh`
- **Output Directory:** `dist/public`
- **Install Command:** `npm install`

### Environment Variables (OBRIGATÓRIO)
```
DATAJUD_API_KEY=sua_chave_aqui
SESSION_SECRET=string_secreta_aleatoria_minimo_32_caracteres
NODE_ENV=production
```

## 🎯 O que foi corrigido

- ✅ API serverless usa TypeScript nativo do Vercel
- ✅ Removido `api/index.js` para evitar conflito de arquivos
- ✅ **CRITICAL FIX:** Middleware adicionado para restaurar caminho original das rotas
  - Vercel reescreve `/api/tribunals` → `/api/index` 
  - Middleware restaura o path usando headers do Vercel
  - Agora Express consegue rotear corretamente
- ✅ Rota `/api/tribunals` funcionará corretamente
- ✅ CORS configurado com pacote `cors`
- ✅ Script de build simplificado (apenas frontend)

## 🔍 Verificação

Após o deploy, os tribunais devem aparecer normalmente no formulário de busca.

A rota `/api/tribunals` retornará:
```json
{
  "success": true,
  "data": [
    {
      "category": "Tribunais Superiores",
      "items": [...]
    },
    ...
  ]
}
```
