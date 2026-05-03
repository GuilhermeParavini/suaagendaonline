import { Dancing_Script, Great_Vibes, Pacifico } from 'next/font/google';

export const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const greatVibes = Great_Vibes({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
});

export const pacifico = Pacifico({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
});

export const SIGNATURE_FONTS = [
  { value: 'Dancing Script', label: 'Dancing Script' },
  { value: 'Great Vibes', label: 'Great Vibes' },
  { value: 'Pacifico', label: 'Pacifico' },
] as const;

export type SignatureFontValue = (typeof SIGNATURE_FONTS)[number]['value'];

export function signatureFontClass(fonte: string | null | undefined): string {
  switch (fonte) {
    case 'Dancing Script':
      return dancingScript.className;
    case 'Great Vibes':
      return greatVibes.className;
    case 'Pacifico':
      return pacifico.className;
    default:
      return '';
  }
}
