# 🔧 Fix para Deploy no Vercel - Tribunais Não Aparecem

## Problema Identificado

O arquivo `api/index.ts` não estava sendo compilado para JavaScript, causando erro nas funções serverless do Vercel.

## ✅ Solução Aplicada

### 1. Arquivo de Build Criado

Foi criado o arquivo `build-vercel.sh` que compila corretamente:
- Frontend: `vite build` → `dist/public`
- API serverless: `esbuild api/index.ts` → `api/index.js`

### 2. Arquivo `api/index.js` Gerado

O arquivo bundled já foi gerado e contém todo o código necessário (Express + Routes + Storage).

## 📤 Passos para Deploy

### 1. Dar permissão ao script

```bash
chmod +x build-vercel.sh
```

### 2. Adicionar arquivos ao Git

```bash
# Adicionar o build script
git add build-vercel.sh

# Adicionar o arquivo bundled da API
git add api/index.js

# Adicionar este arquivo de documentação
git add VERCEL_BUILD_FIX.md

# Adicionar api/index.ts atualizado
git add api/index.ts
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

- ✅ API serverless agora compila corretamente
- ✅ Arquivo `api/index.js` bundled contém todas as rotas
- ✅ Rota `/api/tribunals` funcionará corretamente
- ✅ CORS configurado com pacote `cors`
- ✅ Script de build automatizado

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
