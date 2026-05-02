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

const { data: rows } = await supabase
  .from('financeiro')
  .select('descricao, valor, forma_pagamento, agendamento_id, agendamentos(status, data_hora, pacientes(nome))')
  .eq('tenant_id', TENANT_ID)
  .order('valor', { ascending: false });

console.log(`Total de financeiros: ${rows.length}`);
for (const r of rows) {
  const ag = r.agendamentos;
  const paciente = ag?.pacientes?.nome ?? '-';
  console.log(
    `  R$ ${r.valor} | ${r.descricao} | ${r.forma_pagamento} | status=${ag?.status ?? 'null'} | paciente=${paciente} | agendamento_id=${r.agendamento_id ?? 'null'}`,
  );
}
