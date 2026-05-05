// Verificacao de schema das mudancas recentes:
// 1) profissionais.intervalo_entre_consultas_min
// 2) tabela documentos_paciente
// 3) agendamentos.token_reagendamento
// 4) bucket documentos-pacientes
// Roda com: node --env-file=.env.local scripts/check-schema.mjs

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

// 1) profissionais.intervalo_entre_consultas_min
{
  const { data, error } = await admin
    .from('profissionais')
    .select('id, intervalo_entre_consultas_min')
    .limit(1);
  if (error) record('profissionais.intervalo_entre_consultas_min', false, error.message);
  else
    record(
      'profissionais.intervalo_entre_consultas_min',
      true,
      `OK (linhas: ${data.length}, exemplo: ${
        data[0]?.intervalo_entre_consultas_min ?? 'tabela vazia'
      })`,
    );
}

// 2) documentos_paciente — existe e estrutura minima esperada
{
  const { data, error } = await admin
    .from('documentos_paciente')
    .select(
      'id, tenant_id, paciente_id, profissional_id, nome_arquivo, tipo_arquivo, tamanho_bytes, storage_path, categoria, descricao, created_at',
    )
    .limit(1);
  if (error)
    record('documentos_paciente (tabela + colunas)', false, error.message);
  else
    record(
      'documentos_paciente (tabela + colunas)',
      true,
      `OK (linhas: ${data.length})`,
    );
}

// 3) agendamentos.token_reagendamento
{
  const { data, error } = await admin
    .from('agendamentos')
    .select('id, token_reagendamento')
    .limit(3);
  if (error) record('agendamentos.token_reagendamento', false, error.message);
  else {
    const total = data.length;
    const comToken = data.filter((r) => !!r.token_reagendamento).length;
    record(
      'agendamentos.token_reagendamento',
      true,
      `OK (${comToken}/${total} linhas com token)`,
    );
  }
}

// 3b) DEFAULT do token funciona em insert? Faz dry-run pegando 1 agendamento existente
//     e verificando que existe coluna com valor nao-null em pelo menos um registro recente.
{
  const { data, error } = await admin
    .from('agendamentos')
    .select('id, token_reagendamento, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) {
    record('token_reagendamento DEFAULT em registros recentes', false, error.message);
  } else if (data.length === 0) {
    record(
      'token_reagendamento DEFAULT em registros recentes',
      true,
      'Sem agendamentos para amostragem',
    );
  } else {
    const todosTem = data.every((r) => typeof r.token_reagendamento === 'string' && r.token_reagendamento.length > 0);
    record(
      'token_reagendamento DEFAULT em registros recentes',
      todosTem,
      todosTem
        ? `Todos os ${data.length} ultimos agendamentos tem token`
        : `Apenas ${data.filter((r) => !!r.token_reagendamento).length}/${data.length} tem token (DEFAULT pode nao ter sido aplicado retroativamente — esperado para registros antigos)`,
    );
  }
}

// 4) Bucket documentos-pacientes
{
  const { data, error } = await admin.storage.listBuckets();
  if (error) record('bucket documentos-pacientes', false, error.message);
  else {
    const found = data.find((b) => b.name === 'documentos-pacientes');
    if (!found) record('bucket documentos-pacientes', false, 'Nao encontrado');
    else
      record(
        'bucket documentos-pacientes',
        true,
        `OK (publico=${found.public})`,
      );
  }
}

// 5) Tabela sugestoes_cards_log
{
  const { data, error } = await admin
    .from('sugestoes_cards_log')
    .select(
      'id, tenant_id, profissional_id, cards_exibidos, card_clicado, hora, dia_semana, pagina_origem, created_at',
    )
    .limit(1);
  if (error)
    record('sugestoes_cards_log (tabela + colunas)', false, error.message);
  else
    record(
      'sugestoes_cards_log (tabela + colunas)',
      true,
      `OK (linhas: ${data.length})`,
    );
}

console.log('\nResultado da verificacao de schema:\n');
for (const r of results) {
  const tag = r.ok ? '[OK]' : '[FAIL]';
  console.log(`${tag} ${r.name} — ${r.detail}`);
}
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${fails === 0 ? 'Tudo certo.' : `${fails} verificacao(es) com falha.`}`);
process.exit(fails === 0 ? 0 : 1);
