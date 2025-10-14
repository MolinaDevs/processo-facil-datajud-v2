# Deploy no Vercel - Processo Fácil DataJud

## 📋 Pré-requisitos

1. Conta no Vercel (https://vercel.com)
2. Repositório GitHub atualizado
3. Chaves de API configuradas:
   - `DATAJUD_API_KEY`
   - `SESSION_SECRET`
   - `DATABASE_URL` (se usar PostgreSQL)

## 🚀 Passo a Passo do Deploy

### 1. Conectar Repositório

1. Acesse https://vercel.com/new
2. Clique em **"Import Git Repository"**
3. Selecione o repositório: `MolinaDevs/processo-facil-datajud`
4. Clique em **"Import"**

### 2. Configurar Projeto

Na tela de configuração:

- **Framework Preset:** `Other` (deixe em branco)
- **Root Directory:** `./` (raiz do projeto)
- **Build Command:** `npm run build`
- **Output Directory:** `dist/client`
- **Install Command:** `npm install`

### 3. Configurar Variáveis de Ambiente

Adicione as seguintes variáveis em **Environment Variables**:

```bash
DATAJUD_API_KEY=seu_token_datajud_aqui
SESSION_SECRET=uma_string_secreta_aleatoria
NODE_ENV=production
```

Se usar banco de dados PostgreSQL:
```bash
DATABASE_URL=sua_connection_string_postgres
```

### 4. Deploy

1. Clique em **"Deploy"**
2. Aguarde o build finalizar (2-5 minutos)
3. Seu site estará disponível em: `https://seu-projeto.vercel.app`

## 🔧 Configuração Automática

O projeto já está configurado com:

✅ `vercel.json` - Configuração de rotas e functions  
✅ `api/index.ts` - Função serverless da API  
✅ CORS configurado  
✅ Build otimizado para produção  

## 🔄 Deploys Automáticos

Após o primeiro deploy:

- **Push para `main`** → Deploy automático em produção
- **Pull Requests** → Preview deploy automático
- **Branches** → Deploy de preview

## 🐛 Troubleshooting

### Erro: "Module not found"
- Verifique se todas as dependências estão no `package.json`
- Execute: `npm install` localmente para verificar

### Erro: "API não responde"
- Verifique se as variáveis de ambiente estão configuradas
- Acesse os logs em: Vercel Dashboard → Project → Deployments → View Function Logs

### Erro: "Build falhou"
- Verifique os logs de build no Vercel
- Teste localmente: `npm run build`

## 📊 Monitoramento

Acesse o painel do Vercel para:
- Ver logs em tempo real
- Monitorar uso de recursos
- Configurar domínio customizado
- Ver analytics de acesso

## 🔗 Links Úteis

- [Documentação Vercel](https://vercel.com/docs)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Serverless Functions](https://vercel.com/docs/functions)

## ⚙️ Configuração Avançada

### Domínio Customizado

1. Vercel Dashboard → Project → Settings → Domains
2. Adicione seu domínio
3. Configure DNS conforme instruções

### Limites do Plano Free

- ✅ 100GB de bandwidth/mês
- ✅ Builds ilimitados
- ✅ Serverless Functions: 100 horas/mês
- ✅ Domínio customizado incluído

---

## 📝 Checklist de Deploy

- [ ] Repositório atualizado no GitHub
- [ ] Variáveis de ambiente configuradas
- [ ] Build testado localmente
- [ ] Deploy realizado com sucesso
- [ ] API testada em produção
- [ ] Frontend carregando corretamente
- [ ] Todas as funcionalidades testadas

---

**Última atualização:** Outubro 2025
