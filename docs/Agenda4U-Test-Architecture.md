# Agenda4U Test Architecture

## 1. Baseline
- Baseline de código analisada: `main @ d38eb5441f78842645fc35db354e2bedd4908b18`, conforme `docs/Agenda4U-Codex-Migration-Plan.md`.
- Fontes documentais lidas integralmente: `docs/Agenda4U-Kit-de-Validacao-Beta-v2.md`, `docs/Agenda4U-Guia-do-Usuario-v2.md`, `docs/Agenda4U-Codex-Migration-Plan.md`.
- Escopo desta arquitetura: definir ambiente seguro, matriz de validação e trilha futura de automação sem alterar código.
- Evidências principais de código: `src/app`, `src/actions`, `src/lib`, `src/app/api/*`, `public/sw.js`, `vercel.json`, `.env.local`, `.env.local.example`.

## 2. Environment Safety
- Arquivo: `.env.local` | Classificação provável: **PRODUCTION** | Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `RESEND_API_KEY`, `OPENAI_API_KEY`, `CRON_SECRET`
- Arquivo: `.env.local.example` | Classificação provável: **DEVELOPMENT** | Variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`, `RESEND_API_KEY`, `CRON_SECRET`
- STRIPE MODE: UNKNOWN
- Evidência sobre Supabase local:
  - `.env.local` aponta `NEXT_PUBLIC_APP_URL` para `https://www.appagenda4u.com`.
  - `.env.local` contém `SUPABASE_SERVICE_ROLE_KEY` e `NEXT_PUBLIC_SUPABASE_URL` reais.
  - Scripts em `scripts/` leem `.env.local` e usam `service_role` com IDs fixos de tenant, o que é incompatível com um ambiente local seguro.
- ENVIRONMENT SAFETY: **UNSAFE**
- Decisão operacional: não executar testes com escrita usando a configuração local atual.

## 3. Dangerous Operations Audit
| Caminho | Finalidade | Escreve dados? | Remove dados? | Usa service_role? | Possui autenticação? | NODE_ENV guard? | Secret guard? | Poderia atingir produção? | Severidade | Classificação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `src/app/api/seed/route.ts` | Disparar seed completo e limpeza opcional via HTTP. | YES | YES | YES (indireto via `src/actions/seed.ts`) | NO | YES | YES (apenas em produção) | YES | CRITICAL | DANGEROUS |
| `src/app/api/seed-anamnese/route.ts` | Popular templates de anamnese do profissional autenticado. | YES | NO | YES (indireto via `src/actions/anamnese.ts`) | YES | NO | NO | YES | HIGH | WEAKLY_PROTECTED |
| `src/app/api/seed-feriados/route.ts` | Inserir feriados nacionais nos anos 2026 e 2027. | YES | NO | YES (indireto via `src/actions/feriados.ts`) | YES | NO | NO | YES | HIGH | WEAKLY_PROTECTED |
| `scripts/cleanup-financeiro-duplicates.mjs` | Deletar lançamentos financeiros órfãos por tenant. | YES | YES | YES | NO | NO | NO | YES | CRITICAL | DANGEROUS |
| `scripts/update-tenant-slug.mjs` | Atualizar slug de tenant diretamente no banco. | YES | NO | YES | NO | NO | NO | YES | HIGH | DANGEROUS |
| `scripts/check-schema.mjs` | Diagnóstico de schema, bucket e colunas recentes. | NO | NO | YES | NO | NO | NO | YES | MEDIUM | PROTECTED |
| `scripts/check-agenda-data.mjs` | Diagnóstico read-only de agenda/agendamentos por tenant. | NO | NO | YES | NO | NO | NO | YES | MEDIUM | PROTECTED |
| `scripts/check-pacientes-data.mjs` | Diagnóstico read-only de pacientes por tenant. | NO | NO | YES | NO | NO | NO | YES | MEDIUM | PROTECTED |
| `scripts/check-tenant-slug.mjs` | Listar tenants/slugs para inspeção operacional. | NO | NO | YES | NO | NO | NO | YES | MEDIUM | PROTECTED |
| `scripts/paciente-ids.mjs` | Listar IDs e URLs de pacientes de um tenant específico. | NO | NO | YES | NO | NO | NO | YES | MEDIUM | PROTECTED |
| `scripts/verify-seed.mjs` | Verificar seed de financeiro/agendamentos em um tenant fixo. | NO | NO | YES | NO | NO | NO | YES | MEDIUM | PROTECTED |

Resumo do gate de risco:
- `src/app/api/seed/route.ts` é a superfície mais perigosa: aceita GET/POST e só exige segredo quando `NODE_ENV === production`.
- `src/app/api/seed-anamnese/route.ts` e `src/app/api/seed-feriados/route.ts` têm autenticação, mas ainda escrevem em banco real via `service_role`.
- Os scripts de `scripts/` usam `.env.local` e `SUPABASE_SERVICE_ROLE_KEY`, vários com IDs fixos de tenant. Em ambiente local atual, isso é incompatível com qualquer execução automática segura.

## 4. QA Environment Strategy
Arquiteturas consideradas:
- **A. Supabase local** — rejeitada por falta de migrations completas e risco de divergência de RLS/Auth/Storage.
- **B. Projeto Supabase separado para QA** — recomendada.
- **C. Clone controlado somente do schema de produção, sem dados reais** — necessário como insumo inicial, mas não suficiente sozinho como ambiente de execução.
- **D. Mocks** — úteis apenas como complemento para integrações caras/sensíveis.

Arquitetura recomendada: **B. projeto Supabase separado para QA**.

Justificativa:
- O Git não contém schema completo suficiente para reconstrução confiável; portanto, o QA precisa nascer de um clone controlado do schema real, sem dados reais, e ser hospedado em projeto Supabase próprio.
- O sistema depende de multi-tenant, RLS, Auth, Storage e `service_role`; mocks não cobrem esses contratos de forma suficiente para os fluxos principais.
- LGPD impede uso de produção como ambiente de teste; o tenant QA deve ser 100% sintético.
- Stripe, Resend, OpenAI, Zenvia, Push e Cron exigem isolamento explícito para evitar custo, spam e escrita indevida.

Requisitos do ambiente QA:
- Projeto Supabase exclusivo para QA.
- Export controlado apenas de schema/objetos necessários, sem dados reais.
- Buckets QA separados.
- Chaves próprias de integração (Stripe test mode, caixa de e-mail controlada, provedor SMS desabilitado ou stub, VAPID de QA).
- Política de dados sintéticos obrigatória.

## 5. QA Tenant
Tenant sintético obrigatório com prefixo `QA_`:
- `QA_ADMIN` — administrador principal do tenant QA.
- `QA_PROFISSIONAL` — usuário profissional padrão.
- `QA_SECRETARIA` — usuário com papel secretaria para validar permissões.
- `QA_PACIENTE_ADULTO` — adulto com dados básicos sintéticos.
- `QA_PACIENTE_MENOR` — menor de idade sintético.
- `QA_RESPONSAVEL` — responsável legal do paciente menor.

Dados sintéticos mínimos:
- Procedimentos: `QA_Avaliacao_60`, `QA_Retorno_30`, `QA_Terapia_50`.
- Horários: segunda a sexta, blocos `08:00-12:00` e `14:00-18:00`.
- Bloqueios: `QA_FERIAS_CURTAS`, `QA_FOLGA_TESTE`, `QA_LICENCA_TESTE`.
- Agendamentos: estados `agendado`, `confirmado`, `em_atendimento`, `concluido`, `faltou`, `cancelado`, `reagendado`.
- Financeiro: 1 receita paga, 1 receita pendente, 1 despesa paga, 1 despesa pendente.
- Plano de tratamento: 1 plano com 3 sessões futuras e 1 sessão concluída.
- Estoque: 2 produtos (`QA_GEL_UTS`, `QA_LUVA_P`) com entrada, saída e alerta de baixa.
- Documentos/arquivos: PDFs e imagens sintéticas sem qualquer dado real.

Regras:
- Nenhum nome, telefone, CPF, e-mail ou endereço pode corresponder a pessoa real.
- Identificadores textuais devem usar prefixo `QA_` também em descrições operacionais e observações.

## 6. Validation Matrix
| ID | Descrição | Tipo | Automação | Risco | Rota | Código principal | Fixture | Serviço externo | Observação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | Homepage abre em www.appagenda4u.com sem erro de servidor. | PROD-SMOKE | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `Supabase` | Read-only; elegível para smoke em produção sem escrita. |
| A02 | Hero, benefícios, IA, planos, comparativo, especialidades, como funciona e CTA final aparecem. | E2E | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| A03 | Botões “Começar grátis”/“Experimentar grátis” levam ao cadastro. | E2E | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| A04 | Alternância Mensal/Anual atualiza os valores exibidos. | E2E | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| A05 | Preços e limites dos quatro planos são consistentes. | E2E | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| A06 | Links “Entrar”, Termos e Privacidade funcionam. | PROD-SMOKE | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `Supabase` | Read-only; elegível para smoke em produção sem escrita. |
| A07 | Rodapé exibe contato e informações legais esperadas. | E2E | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| A08 | Layout não tem overflow horizontal em 390 px. | E2E | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| A09 | Textos, acentos e caracteres especiais renderizam corretamente. | E2E | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| A10 | Manifest/PWA e ícones principais carregam sem 404. | PROD-SMOKE | YES | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `Supabase` | Read-only; elegível para smoke em produção sem escrita. |
| A11 | Conteúdo público não expõe dados internos, chaves ou mensagens de debug. | PROD-SMOKE | PARTIAL | LOW | `/`, `/termos`, `/privacidade`, `/manifest.json`, `/sw.js` | `src/app/page.tsx`, `src/components/landing/*`, `src/app/manifest.json`, `public/sw.js` | `none` | `Supabase` | Read-only; elegível para smoke em produção sem escrita. |
| B01 | Cadastro valida nome, e-mail, senha mínima de 6 caracteres e confirmação de senha. | INTEGRATION | YES | HIGH | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| B02 | Especialidade obrigatória e opção “Outro” funcionam. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| B03 | Conta é criada e e-mail de confirmação é enviado. | INTEGRATION | PARTIAL | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| B04 | Link de confirmação autentica/encaminha corretamente. | E2E | PARTIAL | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| B05 | Login com credenciais válidas funciona. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| B06 | Login inválido mostra mensagem clara sem vazar detalhes técnicos. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| B07 | Logout encerra sessão e protege rotas privadas. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| B08 | “Esqueci minha senha” envia e-mail. | INTEGRATION | PARTIAL | HIGH | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| B09 | Link de redefinição permite criar nova senha. | E2E | PARTIAL | HIGH | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| B10 | Usuário não autenticado é redirecionado para /login ao abrir área privada. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| B11 | Usuário autenticado sem perfil é enviado para /onboarding. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| B12 | Usuário com perfil não volta indevidamente ao onboarding. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| B13 | Sessão continua funcionando após refresh. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| B14 | Abertura em aba anônima não reutiliza sessão anterior. | E2E | YES | MEDIUM | `/cadastro`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/auth/callback`, `/auth/confirm` | `src/app/(auth)/*`, `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/app/auth/confirm/route.ts`, `src/lib/supabase/proxy.ts` | `QA_AUTH_NEW_USER`, `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C01 | Onboarding mostra 2 etapas: Seus dados e Seu atendimento. | E2E | YES | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C02 | Nome com menos de 3 caracteres é rejeitado. | E2E | YES | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C03 | Registro profissional é exigido quando a especialidade possui conselho. | E2E | YES | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| C04 | Telefone inválido é rejeitado. | E2E | YES | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C05 | Quatro opções de local de atendimento aparecem. | E2E | YES | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C06 | Nome do consultório é obrigatório quando “consultório/clínica” é selecionado. | E2E | YES | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C07 | Cidade e estado são obrigatórios. | E2E | YES | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C08 | Concluir onboarding cria perfil/tenant e abre /inicio. | E2E | PARTIAL | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| C09 | Checklist de primeiro uso exibe 8 passos. | E2E | YES | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C10 | Progresso do checklist muda conforme ações são concluídas. | E2E | PARTIAL | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C11 | Itens avançados ficam ocultos para tenant novo quando aplicável. | E2E | PARTIAL | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| C12 | Após completar onboarding, navegação avançada aparece conforme regras. | E2E | PARTIAL | MEDIUM | `/onboarding`, `/inicio` | `src/app/(auth)/onboarding/page.tsx`, `src/actions/onboarding.ts`, `src/actions/onboarding-checklist.ts`, `src/app/(dashboard)/layout.tsx` | `QA_ADMIN` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D01 | Editar nome, especialidade, registro e telefone em Meus dados. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| D02 | Editar intervalo entre consultas. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D03 | Editar bio pública. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D04 | Editar dados da clínica com papel Administrador. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D05 | Usuário sem permissão não edita dados reservados ao administrador. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D06 | Upload de logo aceita formatos/tamanho válidos e rejeita inválidos. | INTEGRATION | PARTIAL | HIGH | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Exige fixture de arquivo sintético e validação de tipo/tamanho. |
| D07 | Configurar assinatura por fonte cursiva. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D08 | Upload de imagem de assinatura funciona. | INTEGRATION | PARTIAL | HIGH | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Exige fixture de arquivo sintético e validação de tipo/tamanho. |
| D09 | Configurar horários em dias úteis. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| D10 | Adicionar dois blocos no mesmo dia. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| D11 | Desativar sábado/domingo. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D12 | Cadastrar procedimento com nome, duração e valor. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D13 | Desativar procedimento remove do fluxo público quando esperado. | E2E | PARTIAL | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D14 | Criar/editar template de anamnese. | E2E | PARTIAL | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| D15 | Criar bloqueio de férias/folga/licença. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| D16 | Links de agendamento, cadastro e pré-consulta podem ser copiados. | E2E | YES | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| D17 | Seção de módulos habilita/desabilita recursos sem quebrar navegação. | E2E | PARTIAL | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D18 | Preferências de notificações push podem ser salvas. | INTEGRATION | PARTIAL | HIGH | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Web Push`, `Supabase` | Preferir validação manual ou ambiente controlado por device. |
| D19 | Templates de mensagens podem ser salvos. | E2E | PARTIAL | MEDIUM | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| D20 | Log de acesso/LGPD aparece para papel autorizado. | E2E | PARTIAL | HIGH | `/configuracoes` | `src/app/(dashboard)/configuracoes/page.tsx`, `src/actions/configuracoes.ts`, `src/actions/planos.ts`, `src/actions/equipe.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E01 | Cadastrar paciente adulto com dados mínimos. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E02 | Cadastrar paciente com todos os campos opcionais. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E03 | Cadastrar menor de 18 anos e exigir responsável legal. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E04 | Buscar paciente por nome. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E05 | Buscar por CPF/telefone quando suportado. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E06 | Abrir ficha do paciente. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E07 | Editar dados do paciente. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E08 | CPF aparece mascarado nas superfícies definidas. | E2E | PARTIAL | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E09 | Abas Dados, Anamnese, Documentos, Planos e Histórico funcionam. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E10 | Upload de documento respeita validações. | INTEGRATION | PARTIAL | HIGH | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Exige fixture de arquivo sintético e validação de tipo/tamanho. |
| E11 | Consentimentos podem ser registrados/consultados. | E2E | PARTIAL | HIGH | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E12 | Excluir paciente exige confirmação e respeita regra de permissão. | E2E | PARTIAL | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E13 | Busca global Ctrl+K encontra paciente. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| E14 | Contato preferencial é exibido corretamente. | E2E | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| E15 | Paciente sem e-mail é sinalizado sem quebrar fluxos. | INTEGRATION | YES | LOW | `/pacientes`, `/pacientes/[id]` | `src/app/(dashboard)/pacientes/*`, `src/actions/pacientes.ts`, `src/actions/documentos-paciente.ts`, `src/actions/consentimento.ts` | `QA_PACIENTE_ADULTO`, `QA_PACIENTE_MENOR`, `QA_RESPONSAVEL` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| F01 | Link público /cadastro-paciente/[slug] abre sem login. | E2E | YES | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F02 | Paciente se cadastra pelo link e aparece no tenant correto. | E2E | PARTIAL | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F03 | Consentimento/LGPD público é apresentado quando exigido. | E2E | PARTIAL | HIGH | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F04 | Link /agendar/[slug] abre perfil e procedimentos. | E2E | YES | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F05 | Horários respeitam disponibilidade configurada. | E2E | PARTIAL | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F06 | Bloqueios/feriados removem horários indisponíveis. | E2E | PARTIAL | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| F07 | Paciente conclui agendamento sem criar conta. | E2E | PARTIAL | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| F08 | Novo agendamento aparece na agenda interna. | E2E | PARTIAL | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F09 | E-mail de confirmação é enviado. | INTEGRATION | PARTIAL | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| F10 | Link /pre-consulta/[slug] abre e aceita respostas. | E2E | PARTIAL | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F11 | Respostas de pré-consulta chegam à ficha correta. | E2E | PARTIAL | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F12 | Link /reagendar/[token] permite trocar horário válido. | E2E | PARTIAL | HIGH | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F13 | Token inválido/expirado falha de forma segura. | E2E | YES | HIGH | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| F14 | Fluxos públicos não exibem dados de outros pacientes/tenants. | E2E | YES | MEDIUM | `/cadastro-paciente/[slug]`, `/agendar/[slug]`, `/pre-consulta/[slug]`, `/reagendar/[token]`, `/avaliacao/[id]` | `src/app/(publico)/*`, `src/actions/agendamento-publico.ts`, `src/actions/pre-consulta.ts`, `src/actions/avaliacoes.ts`, `src/lib/agendamento-publico.ts` | `QA_PUBLIC_PATIENT_FLOW` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G01 | Criar agendamento pelo painel/botão +. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| G02 | Selecionar paciente e procedimento. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G03 | Duração e horário respeitam procedimento/configuração. | E2E | PARTIAL | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G04 | Visualização diária funciona. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| G05 | Visualização semanal funciona. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G06 | Visualização mensal funciona. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G07 | Navegar para período anterior/próximo. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G08 | Botão Hoje retorna à data atual. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G09 | Agendado -> Confirmado. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G10 | Confirmado -> Em atendimento. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G11 | Concluir atendimento atualiza status. | E2E | PARTIAL | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G12 | Marcar falta funciona. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G13 | Cancelar agendamento libera horário e mantém histórico. | E2E | PARTIAL | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G14 | Reagendar altera data/horário e mantém integridade. | E2E | PARTIAL | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G15 | Feriados/bloqueios aparecem corretamente. | E2E | PARTIAL | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| G16 | Lista de espera aceita inclusão e remoção. | E2E | PARTIAL | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G17 | Badge da lista de espera reflete contagem. | E2E | PARTIAL | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| G18 | Agenda de um profissional não vaza agendamentos de outro tenant. | E2E | YES | MEDIUM | `/agenda`, `/lista-espera` | `src/app/(dashboard)/agenda/page.tsx`, `src/actions/agendamentos.ts`, `src/actions/lista-espera.ts`, `src/actions/bloqueios.ts`, `src/actions/feriados.ts` | `QA_TENANT_CORE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H01 | Iniciar atendimento a partir do agendamento. | E2E | YES | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H02 | Registrar evolução por texto e salvar. | E2E | YES | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H03 | Gravar áudio e enviar para transcrição. | INTEGRATION | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H04 | Texto transcrito entra no campo correto. | INTEGRATION | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H05 | Editar transcrição antes de salvar. | INTEGRATION | YES | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H06 | Limite mensal de transcrição é respeitado. | INTEGRATION | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H07 | Criar/preencher anamnese. | E2E | YES | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H08 | Exportar/imprimir anamnese em PDF. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H09 | Criar documento clínico/arquivo do paciente. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H10 | Gerar atestado quando fluxo estiver disponível. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H11 | Gerar plano de cuidados. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H12 | Gerar relatório clínico. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H13 | Criar plano de tratamento. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H14 | Registrar sessões do plano. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H15 | Alta do paciente/fluxo relacionado funciona. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H16 | Aftercare/acompanhamento pode ser criado quando módulo ativo. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| H17 | Concluir atendimento grava histórico. | E2E | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H18 | E-mail/avaliação pós-atendimento dispara conforme configuração. | INTEGRATION | PARTIAL | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| H19 | Reabrir ficha mantém evolução e histórico. | E2E | YES | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| H20 | Dados clínicos permanecem isolados por tenant/role. | E2E | YES | HIGH | `/atendimento/[id]`, `/anamnese/[id]/print`, `/atestado/[id]`, `/plano-cuidados/[id]`, `/relatorio-clinico/[id]` | `src/app/(dashboard)/atendimento/[id]/page.tsx`, `src/actions/evolucoes.ts`, `src/actions/anamnese.ts`, `src/actions/documentos.ts`, `src/actions/planos-tratamento.ts`, `src/actions/aftercare.ts` | `QA_ATENDIMENTO_DATA` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I01 | Criar receita manual. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| I02 | Criar despesa manual. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| I03 | Alternar status pago/pendente. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I04 | Receita automática de atendimento concluído é criada quando aplicável. | E2E | PARTIAL | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| I05 | Gerar recibo com dados corretos. | E2E | PARTIAL | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I06 | Logo/assinatura aparecem no recibo. | E2E | PARTIAL | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I07 | Recibo público abre somente o registro esperado. | E2E | PARTIAL | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I08 | Filtros por período funcionam. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I09 | Cards de receita/despesa/saldo são consistentes. | E2E | PARTIAL | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I10 | Comissões calculam conforme configuração. | E2E | PARTIAL | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I11 | Usuário sem permissão não vê financeiro consolidado. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I12 | Relatório de faturamento funciona. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I13 | Relatório de pacientes funciona. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I14 | Relatório de agendamentos funciona. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| I15 | Relatório de inadimplência funciona. | E2E | YES | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| I16 | Exportação CSV abre sem corrupção. | E2E | PARTIAL | HIGH | `/financeiro`, `/financeiro/recibo/[id]`, `/recibo/[id]`, `/relatorios` | `src/app/(dashboard)/financeiro/page.tsx`, `src/actions/financeiro.ts`, `src/actions/relatorios.ts`, `src/actions/documentos.ts` | `QA_FINANCEIRO` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| J01 | Abrir Assistente IA. | E2E | YES | HIGH | `/api/assistente`, `/api/assistente/sugestoes`, `/api/assistente/feedback` | `src/app/api/assistente/*`, `src/actions/assistente-uso.ts`, `src/lib/assistente-functions.ts`, `src/lib/assistente-prompts.ts` | `QA_ADMIN`, `QA_IA_STUB` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| J02 | Enviar pergunta válida e receber resposta. | E2E | PARTIAL | HIGH | `/api/assistente`, `/api/assistente/sugestoes`, `/api/assistente/feedback` | `src/app/api/assistente/*`, `src/actions/assistente-uso.ts`, `src/lib/assistente-functions.ts`, `src/lib/assistente-prompts.ts` | `QA_ADMIN`, `QA_IA_STUB` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| J03 | Contador de uso do Assistente IA incrementa. | E2E | PARTIAL | HIGH | `/api/assistente`, `/api/assistente/sugestoes`, `/api/assistente/feedback` | `src/app/api/assistente/*`, `src/actions/assistente-uso.ts`, `src/lib/assistente-functions.ts`, `src/lib/assistente-prompts.ts` | `QA_ADMIN`, `QA_IA_STUB` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| J04 | Limite mensal do plano é respeitado. | E2E | PARTIAL | HIGH | `/api/assistente`, `/api/assistente/sugestoes`, `/api/assistente/feedback` | `src/app/api/assistente/*`, `src/actions/assistente-uso.ts`, `src/lib/assistente-functions.ts`, `src/lib/assistente-prompts.ts` | `QA_ADMIN`, `QA_IA_STUB` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| J05 | Erros do provedor de IA são tratados sem quebrar a página. | E2E | PARTIAL | HIGH | `/api/assistente`, `/api/assistente/sugestoes`, `/api/assistente/feedback` | `src/app/api/assistente/*`, `src/actions/assistente-uso.ts`, `src/lib/assistente-functions.ts`, `src/lib/assistente-prompts.ts` | `QA_ADMIN`, `QA_IA_STUB` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| J06 | Resposta não expõe dados de outro tenant. | E2E | YES | HIGH | `/api/assistente`, `/api/assistente/sugestoes`, `/api/assistente/feedback` | `src/app/api/assistente/*`, `src/actions/assistente-uso.ts`, `src/lib/assistente-functions.ts`, `src/lib/assistente-prompts.ts` | `QA_ADMIN`, `QA_IA_STUB` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| J07 | Feedback positivo/negativo do assistente pode ser enviado. | E2E | YES | HIGH | `/api/assistente`, `/api/assistente/sugestoes`, `/api/assistente/feedback` | `src/app/api/assistente/*`, `src/actions/assistente-uso.ts`, `src/lib/assistente-functions.ts`, `src/lib/assistente-prompts.ts` | `QA_ADMIN`, `QA_IA_STUB` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| J08 | Sugestões do assistente carregam. | E2E | YES | HIGH | `/api/assistente`, `/api/assistente/sugestoes`, `/api/assistente/feedback` | `src/app/api/assistente/*`, `src/actions/assistente-uso.ts`, `src/lib/assistente-functions.ts`, `src/lib/assistente-prompts.ts` | `QA_ADMIN`, `QA_IA_STUB` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| K01 | Administrador convida novo membro. | E2E | PARTIAL | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K02 | Convite por token abre fluxo correto. | E2E | PARTIAL | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K03 | Papel Administrador possui acessos administrativos. | E2E | YES | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K04 | Papel Profissional acessa apenas o permitido. | E2E | YES | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K05 | Papel Secretária não acessa IA/financeiro restrito. | E2E | YES | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| K06 | Usuário de um tenant não acessa dados de outro tenant por URL direta. | E2E | YES | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K07 | Módulo Estoque pode ser ocultado/mostrado. | E2E | PARTIAL | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K08 | Cadastrar produto de estoque. | E2E | YES | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K09 | Registrar entrada de estoque. | E2E | YES | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K10 | Registrar saída de estoque. | E2E | YES | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K11 | Alerta de estoque baixo funciona. | E2E | PARTIAL | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K12 | Módulo Planos de Tratamento respeita habilitação. | E2E | PARTIAL | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K13 | Módulo Comissões respeita habilitação/permissões. | E2E | PARTIAL | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| K14 | Módulo Aftercare respeita habilitação. | E2E | PARTIAL | HIGH | `/configuracoes`, `/estoque` | `src/actions/equipe.ts`, `src/actions/convites.ts`, `src/actions/estoque.ts`, `src/actions/comissoes.ts`, `src/lib/permissoes.ts` | `QA_ADMIN`, `QA_PROFISSIONAL`, `QA_SECRETARIA`, `QA_ESTOQUE` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| L01 | E-mail de confirmação de agendamento chega e tem layout correto. | INTEGRATION | PARTIAL | LOW | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| L02 | E-mail de cancelamento/reagendamento quando aplicável. | INTEGRATION | PARTIAL | LOW | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| L03 | Lembrete programado executa sem duplicação. | E2E | PARTIAL | LOW | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Vercel Cron`, `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| L04 | Follow-up programado executa sem duplicação. | E2E | PARTIAL | LOW | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Vercel Cron`, `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| L05 | Avaliação pós-atendimento funciona. | E2E | PARTIAL | LOW | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| L06 | SMS usa preferências e provedor configurado quando habilitado. | INTEGRATION | PARTIAL | HIGH | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Zenvia`, `Supabase` | Não enviar SMS real em automação padrão. |
| L07 | Falha do provedor de SMS é tratada. | INTEGRATION | PARTIAL | HIGH | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Zenvia`, `Supabase` | Não enviar SMS real em automação padrão. |
| L08 | Push subscription pode ser criada/removida. | INTEGRATION | PARTIAL | HIGH | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Web Push`, `Supabase` | Preferir validação manual ou ambiente controlado por device. |
| L09 | Notificação push não é enviada para usuário sem consentimento. | INTEGRATION | PARTIAL | HIGH | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Web Push`, `Supabase` | Preferir validação manual ou ambiente controlado por device. |
| L10 | Templates personalizados não quebram e-mails/mensagens. | INTEGRATION | PARTIAL | LOW | `/api/cron/lembrete`, `/api/cron/followup`, `/api/cron/feature-discovery` | `src/lib/email.ts`, `src/lib/notificacoes.ts`, `src/lib/sms-server.ts`, `src/lib/push-server.ts`, `src/app/api/cron/*` | `QA_COMMS` | `Resend`, `Supabase Auth` | Evitar destinatários reais; preferir stub ou caixa controlada. |
| M01 | PWA instala no Android/Chrome. | MANUAL | NO | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M02 | PWA instala no iPhone/Safari. | MANUAL | NO | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M03 | Service worker atualiza sem ficar preso em versão antiga. | E2E | PARTIAL | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M04 | Banner offline aparece quando aplicável. | E2E | PARTIAL | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M05 | Navegação mobile não tem overflow em 390 px. | E2E | YES | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M06 | Botões têm área de toque adequada. | E2E | PARTIAL | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M07 | Menu inferior não cobre conteúdo. | E2E | YES | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M08 | Sidebar desktop não cobre conteúdo. | E2E | YES | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M09 | Modais cabem em telas pequenas. | E2E | YES | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M10 | Textos e labels têm acentuação PT-BR correta. | E2E | YES | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M11 | Foco de teclado é visível. | E2E | PARTIAL | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M12 | Skip link “Pular para o conteúdo” funciona. | E2E | YES | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M13 | Inputs possuem label/aria adequados. | E2E | PARTIAL | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| M14 | Contraste dos elementos principais é suficiente. | E2E | PARTIAL | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Executar somente em tenant QA sintético e ambiente isolado. |
| M15 | Sem erros críticos no console em fluxos principais. | PROD-SMOKE | YES | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Read-only; elegível para smoke em produção sem escrita. |
| M16 | Sem 404/500 para assets principais. | PROD-SMOKE | YES | LOW | `/manifest.json`, `/sw.js`, fluxos mobile/desktop` | `src/components/layout/ServiceWorkerRegister.tsx`, `src/lib/pwa.ts`, `public/sw.js`, `src/app/manifest.json` | `QA_PWA_DEVICE` | `Browser PWA APIs` | Read-only; elegível para smoke em produção sem escrita. |
| N01 | Trial de 14 dias é aplicado à conta nova. | E2E | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| N02 | Gate de trial expirado bloqueia acesso conforme regra. | E2E | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `OpenAI`, `Supabase` | Isolar custo e dados sintéticos; preferir stub por padrão. |
| N03 | Planos Individual/Equipe3/Equipe5/Clínica10 exibem limites corretos. | E2E | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N04 | Checkout Stripe abre com plano/período correto. | INTEGRATION | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Stripe`, `Supabase` | Executar apenas em Stripe test mode e tenant QA isolado. |
| N05 | Cupom válido é aceito no ambiente de teste. | E2E | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Stripe`, `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N06 | Cupom inválido é rejeitado. | E2E | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Stripe`, `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N07 | Webhook Stripe atualiza assinatura de forma idempotente. | INTEGRATION | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Stripe`, `Supabase` | Executar apenas em Stripe test mode e tenant QA isolado. |
| N08 | Portal Stripe abre para assinatura válida. | INTEGRATION | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Stripe`, `Supabase` | Executar apenas em Stripe test mode e tenant QA isolado. |
| N09 | Cancelamento/troca de plano não altera tenant errado. | E2E | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N10 | Rotas de API rejeitam usuário não autenticado quando necessário. | E2E | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N11 | RLS impede leitura/escrita cross-tenant. | E2E | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N12 | Acesso por ID aleatório não revela registro de outro tenant. | E2E | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N13 | Logs não registram segredos/tokens/CPF completo. | E2E | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N14 | Uploads validam tipo/tamanho e não permitem caminho arbitrário. | INTEGRATION | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Exige fixture de arquivo sintético e validação de tipo/tamanho. |
| N15 | Endpoints de cron exigem CRON_SECRET. | INTEGRATION | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Vercel Cron`, `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N16 | Webhook Stripe valida assinatura. | INTEGRATION | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Stripe`, `Supabase` | Executar apenas em Stripe test mode e tenant QA isolado. |
| N17 | Variáveis secretas nunca são expostas ao cliente. | E2E | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N18 | Homepage e rotas-chave carregam em tempo aceitável. | PROD-SMOKE | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Read-only; elegível para smoke em produção sem escrita. |
| N19 | Refresh em rotas privadas mantém comportamento consistente. | E2E | YES | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |
| N20 | Erros de rede exibem estado recuperável. | E2E | PARTIAL | HIGH | `/plano-expirado`, `/api/stripe/*`, `/api/cron/*` | `src/lib/stripe.ts`, `src/app/api/stripe/*`, `src/lib/supabase/proxy.ts`, `src/lib/supabase/*`, `vercel.json` | `QA_BILLING`, `QA_SECURITY` | `Supabase` | Executar somente em tenant QA sintético e ambiente isolado. |

Contagens da matriz:
- TOTAL: 208
- E2E: 172
- UNIT: 0
- INTEGRATION: 27
- MANUAL: 2
- PROD-SMOKE: 7
- N/A: 0
- DOCUMENTATION GAP: 0
- TEST COVERAGE GAP: 2

- DOCUMENTATION GAP: nenhum gap material do kit foi considerado impeditivo nesta fase; o kit está majoritariamente alinhado ao código auditado.
- TEST COVERAGE GAP: O kit não cobre explicitamente as superfícies de seed/manutenção (`/api/seed`, `/api/seed-anamnese`, `/api/seed-feriados` e scripts `scripts/*.mjs`), embora representem o maior risco operacional local.
- TEST COVERAGE GAP: O kit não cobre explicitamente o cron de `feature-discovery`, que envia comunicações automáticas e pode gerar ruído em ambiente inadequado.

## 7. Automation Architecture
Ferramentas recomendadas:
- **Playwright** para E2E e smoke web.
- **Vitest** para regras puras e utilitários.
- **Integração adicional** para banco/serviços com ambiente QA e stubs controlados.

Árvore futura proposta:
```text
tests/
  e2e/
    public/
    auth/
    onboarding/
    pacientes/
    agenda/
    atendimento/
    financeiro/
    modulos/
  integration/
    supabase/
    stripe/
    resend/
    openai/
    sms/
    push/
    cron/
  unit/
    lib/
    actions/
  fixtures/
    tenants/
    pacientes/
    documentos/
    audio/
  helpers/
    auth/
    api/
    db/
    assertions/
```

Projetos Playwright sugeridos:
- `desktop-chrome` — obrigatório.
- `mobile-chrome` — obrigatório, dado o foco mobile declarado no kit.
- `webkit-iphone` — recomendado apenas para T10/PWA e regressões específicas de Safari; não precisa entrar no primeiro pacote.

## 8. External Services
| Serviço | Decisão | Justificativa |
| --- | --- | --- |
| Supabase | REAL TEST ENVIRONMENT | Núcleo do produto; precisa de Auth, RLS, Storage e multi-tenant reais em projeto QA isolado. |
| Stripe | REAL TEST ENVIRONMENT | Checkout, portal e webhook dependem de contratos reais; usar apenas test mode e tenant QA. |
| Resend | STUB | Para automação padrão, evitar e-mail real; usar stub/capture inbox. Rodadas manuais controladas podem validar layout. |
| OpenAI | STUB | Custos e sensibilidade clínica recomendam stub por padrão; validação manual/integration controlada depois. |
| Zenvia | DISABLED | Não enviar SMS real durante automação base; substituir por stub apenas em fase dedicada. |
| Web Push | MANUAL | Exige device/browser subscription real; bom para validação manual ou smoke controlado. |
| Vercel Cron | MANUAL | Testar handlers por chamada controlada em QA, mas não depender do scheduler real no pacote inicial. |

## 9. Production Smoke Policy
SAFE PROD-SMOKE:
- Abrir `https://www.appagenda4u.com/` e verificar resposta/renderização básica.
- Validar links públicos read-only: `/termos`, `/privacidade`.
- Validar assets públicos principais: `/manifest.json`, `/icon-192.png`, `/icon-512.png`, `/sw.js`.
- Confirmar ausência de 404/500 em homepage e assets críticos.
- Verificar que conteúdo público não expõe stack traces, chaves ou mensagens de debug.

NEVER RUN AGAINST PROD:
- Qualquer fluxo com login se houver risco de escrita/acoplamento à conta real.
- Cadastro de conta, onboarding, criação/edição/exclusão de paciente, agenda, atendimento, financeiro, estoque e equipe.
- `/api/seed`, `/api/seed-anamnese`, `/api/seed-feriados`.
- Qualquer cron manual com `CRON_SECRET`.
- Stripe checkout, portal, webhook e cupons.
- E-mail, SMS, push, OpenAI/transcrição, upload de arquivos e geração de documentos.
- Scripts em `scripts/` com `.env.local` atual.

## 10. CI Strategy
GitHub Actions futuro recomendado:
- **PR**: `lint`, `build`, `unit`.
- **main**: `lint`, `build`, `unit`, `e2e smoke` contra ambiente preview/QA.
- **manual**: suíte seletiva de integração (`stripe`, `cron`, `openai`, `comunicações`) em ambiente QA.
- **pre-deploy**: smoke E2E público + autenticação mínima em preview.
- **post-deploy**: `PROD-SMOKE` estritamente read-only em `www.appagenda4u.com`.

Princípios:
- Nenhum job CI deve usar produção para testes destrutivos.
- Secrets devem apontar para QA isolado.
- Jobs de integração custosa ficam fora do gate padrão de PR.

## 11. Implementation Phases
### T0 Safety
- Objetivo: Fechar riscos de ambiente, segredos e superfícies perigosas antes de qualquer execução.
- Dependências: Confirmação de QA isolado, bloqueio operacional de seeds/scripts perigosos.
- Risco: HIGH
- Esforço: M
- PASS criteria: Ambiente QA definido, política de dados sintéticos aprovada, produção explicitamente fora de escopo destrutivo.

### T1 Public Smoke
- Objetivo: Cobrir landing e rotas públicas read-only sem login.
- Dependências: URL base estável e ambiente navegável.
- Risco: LOW
- Esforço: P
- PASS criteria: Smoke público verde em desktop e mobile sem escrita.

### T2 Auth/Onboarding
- Objetivo: Cobrir cadastro, login, confirmação e onboarding com tenant QA.
- Dependências: Supabase Auth QA, caixa de e-mail controlada ou stub.
- Risco: HIGH
- Esforço: M
- PASS criteria: Conta QA criada/confirmada e onboarding concluído de ponta a ponta.

### T3 Pacientes
- Objetivo: Cobrir CRUD básico, menor/responsável, documentos e consentimentos.
- Dependências: Tenant QA com fixtures de pacientes e storage QA.
- Risco: HIGH
- Esforço: M
- PASS criteria: Paciente adulto e menor trafegam sem vazamento nem quebra de permissão.

### T4 Agenda
- Objetivo: Cobrir horários, bloqueios, feriados, agenda interna e agendamento público.
- Dependências: Dados base de procedimentos/horários e links públicos QA.
- Risco: HIGH
- Esforço: M
- PASS criteria: Agendamento público e interno consistentes, com bloqueios respeitados.

### T5 Atendimento
- Objetivo: Cobrir atendimento, evolução, anamnese, documentos e plano clínico.
- Dependências: Fixtures clínicas sintéticas, upload QA, stubs IA quando necessário.
- Risco: HIGH
- Esforço: G
- PASS criteria: Histórico clínico consistente e isolado por tenant.

### T6 Financeiro
- Objetivo: Cobrir receitas, despesas, recibos, relatórios e inadimplência.
- Dependências: Fixtures financeiros e permissões QA.
- Risco: HIGH
- Esforço: M
- PASS criteria: Financeiro reflete eventos esperados e recibo público é restrito ao registro correto.

### T7 Multi-tenant/Permissões
- Objetivo: Cobrir roles, convites, escopo por tenant e travas de acesso.
- Dependências: Múltiplos tenants QA e papéis distintos.
- Risco: HIGH
- Esforço: G
- PASS criteria: Nenhuma leitura/escrita cross-tenant observável pelos fluxos cobertos.

### T8 Módulos avançados
- Objetivo: Cobrir estoque, comissões, aftercare, lista de espera e módulos.
- Dependências: Plano QA adequado e dados sintéticos adicionais.
- Risco: MEDIUM
- Esforço: M
- PASS criteria: Módulos habilitam/desabilitam corretamente e mantêm navegação íntegra.

### T9 IA/Integrações
- Objetivo: Cobrir Stripe, OpenAI, comunicações e cron em modo controlado.
- Dependências: Stubs/test mode e endpoints QA protegidos.
- Risco: HIGH
- Esforço: G
- PASS criteria: Integrações críticas validadas sem tocar produção nem usuários reais.

### T10 PWA/A11y/Visual
- Objetivo: Cobrir PWA, acessibilidade básica e regressões visuais/responsivas.
- Dependências: Projetos Playwright mobile/desktop e devices de validação.
- Risco: MEDIUM
- Esforço: M
- PASS criteria: Instalação PWA, offline/update, foco e responsividade sem regressões críticas.

## 12. First Test Package
Primeiro pacote recomendado: **Public Smoke com Playwright**.

Restrições atendidas:
- Sem login.
- Sem escrita no banco.
- Sem Stripe.
- Sem Resend.
- Sem SMS.
- Sem OpenAI.
- Sem Push.
- Sem Cron.

Testes exatos a criar:
1. `public-homepage-loads.spec` — homepage abre em `/` e renderiza hero, CTA principal e seções básicas.
2. `public-links-work.spec` — links `Entrar`, `Termos` e `Privacidade` navegam corretamente.
3. `public-pricing-toggle.spec` — alternância Mensal/Anual muda o estado visual da precificação.
4. `public-assets-no-404.spec` — `manifest.json`, `icon-192.png`, `icon-512.png` e `sw.js` respondem sem 404.
5. `public-mobile-390.spec` — em viewport móvel 390 px a landing não cria overflow horizontal crítico.
6. `public-no-debug-leak.spec` — HTML público não contém stack trace, `NEXT_PUBLIC_`, `SUPABASE_SERVICE_ROLE_KEY` ou mensagens de debug óbvias.

Critério de saída do primeiro pacote: 100% verde em `desktop-chrome` e `mobile-chrome` sem tocar dados persistentes.

## 13. Blocking Issues
- `ENVIRONMENT SAFETY` local atual é `UNSAFE`; não é adequado para automação com escrita.
- O repositório não contém migrations/schema completos o bastante para reconstrução fiel do ambiente.
- Existem seeds e scripts de manutenção perigosos apontando para `.env.local`.
- Não há suíte de testes nem CI configurados hoje; tudo começa do zero.

## 14. Go / No-Go
- **GO** para T0 Safety e T1 Public Smoke imediatamente.
- **CONDITIONAL GO** para T2+ somente após provisionar projeto Supabase QA separado e revisar secrets/integrações.
- **NO-GO** para qualquer automação com escrita usando a `.env.local` atual.

## 15. Status Update
- T1 Public Smoke: PASS
- T1.1 Public Smoke CI: IMPLEMENTED
- Public Smoke possui 12 testes.
- O CI não usa secrets.
- `npm run lint` continua com issues pre-existing no código atual.
- Auth/E2E com escrita permanece bloqueado até ambiente QA isolado.
