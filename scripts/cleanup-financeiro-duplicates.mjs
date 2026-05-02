import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    }),
);

const TENANT_ID = '4dcf2f82-1e39-4a9b-958d-9cb22c1754d6';

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// Deletar todos os financeiros com agendamento_id null para o tenant
const { data: orphans, error: orphansErr } = await supabase
  .from('financeiro')
  .select('id')
  .eq('tenant_id', TENANT_ID)
  .is('agendamento_id', null);

if (orphansErr) {
  console.error('Erro ao listar orfaos:', orphansErr.message);
  process.exit(1);
}

console.log(`Encontrados ${orphans.length} financeiros com agendamento_id null`);

if (orphans.length > 0) {
  const ids = orphans.map((o) => o.id);
  const { error: delError } = await supabase
    .from('financeiro')
    .delete()
    .in('id', ids);
  if (delError) {
    console.error('Erro ao deletar:', delError.message);
    process.exit(1);
  }
  console.log(`Deletados ${ids.length}.`);
}

const { data: finalRows } = await supabase
  .from('financeiro')
  .select('id, descricao, valor, agendamento_id')
  .eq('tenant_id', TENANT_ID);

console.log(`Total final de financeiros: ${finalRows.length}`);
for (const r of finalRows) {
  console.log(`  ${r.descricao} | R$ ${r.valor} | agendamento=${r.agendamento_id ?? 'null'}`);
}
