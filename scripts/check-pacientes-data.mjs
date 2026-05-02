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
const USER_ID = 'a501e937-7651-41e7-b640-d36dad4a9772';

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const { data: prof } = await supabase
  .from('profissionais')
  .select('id')
  .eq('user_id', USER_ID)
  .eq('tenant_id', TENANT_ID)
  .single();

const { data: pacientes } = await supabase
  .from('pacientes')
  .select('id, nome, telefone, cpf, menor_idade, data_nascimento')
  .eq('tenant_id', TENANT_ID)
  .eq('ativo', true)
  .order('nome', { ascending: true });

const ids = pacientes.map((p) => p.id);
const { data: ultimas } = await supabase
  .from('agendamentos')
  .select('paciente_id, data_hora')
  .eq('profissional_id', prof.id)
  .eq('status', 'concluido')
  .in('paciente_id', ids)
  .order('data_hora', { ascending: false });

const ultimaPorPaciente = new Map();
for (const r of ultimas) {
  if (!ultimaPorPaciente.has(r.paciente_id)) {
    ultimaPorPaciente.set(r.paciente_id, r.data_hora);
  }
}

console.log(`=== PACIENTES (${pacientes.length}) ===`);
for (const p of pacientes) {
  const ult = ultimaPorPaciente.get(p.id);
  console.log(
    `  ${p.nome.padEnd(20)} | tel=${p.telefone} | cpf=${p.cpf} | menor=${p.menor_idade} | ultima=${ult ?? 'sem'}`,
  );
}
