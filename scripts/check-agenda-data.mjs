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

const today = new Date();
today.setUTCHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

async function fetchDay(label, date) {
  const iso = date.toISOString().slice(0, 10);
  const inicio = `${iso}T00:00:00.000Z`;
  const fim = `${iso}T23:59:59.999Z`;

  const { data: rows, error } = await supabase
    .from('agendamentos')
    .select('id, data_hora, duracao_min, status, pacientes(nome), procedimentos(nome)')
    .eq('profissional_id', prof.id)
    .gte('data_hora', inicio)
    .lte('data_hora', fim)
    .order('data_hora', { ascending: true });

  if (error) {
    console.error(`${label} ERROR:`, error.message);
    return;
  }

  console.log(`\n=== ${label} (${iso}) — ${rows.length} agendamentos ===`);
  for (const r of rows) {
    const dt = new Date(r.data_hora);
    const hora = `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;
    const paciente = (Array.isArray(r.pacientes) ? r.pacientes[0] : r.pacientes)?.nome ?? '-';
    const proc = (Array.isArray(r.procedimentos) ? r.procedimentos[0] : r.procedimentos)?.nome ?? '-';
    console.log(`  ${hora} (${r.duracao_min}min) | ${paciente} | ${proc} | ${r.status}`);
  }
}

await fetchDay('HOJE', today);
await fetchDay('AMANHA', tomorrow);
