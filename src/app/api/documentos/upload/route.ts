import { NextResponse } from 'next/server';
import {
  uploadDocumento,
  type CategoriaDocumento,
} from '@/actions/documentos-paciente';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const CATEGORIAS_VALIDAS: CategoriaDocumento[] = [
  'foto',
  'exame',
  'laudo',
  'receita',
  'outro',
];

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'FormData invalido.' },
      { status: 400 },
    );
  }

  const file = formData.get('file');
  const pacienteId = formData.get('pacienteId');
  const categoriaRaw = formData.get('categoria');
  const descricaoRaw = formData.get('descricao');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: 'Arquivo obrigatorio.' },
      { status: 400 },
    );
  }
  if (typeof pacienteId !== 'string' || !pacienteId) {
    return NextResponse.json(
      { ok: false, error: 'Paciente obrigatorio.' },
      { status: 400 },
    );
  }
  const categoriaStr =
    typeof categoriaRaw === 'string' ? categoriaRaw : 'outro';
  if (
    !CATEGORIAS_VALIDAS.includes(categoriaStr as CategoriaDocumento)
  ) {
    return NextResponse.json(
      { ok: false, error: 'Categoria invalida.' },
      { status: 400 },
    );
  }
  const categoria = categoriaStr as CategoriaDocumento;
  const descricao =
    typeof descricaoRaw === 'string' ? descricaoRaw : undefined;

  const result = await uploadDocumento(pacienteId, file, categoria, descricao);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}
