import { cleanCPF } from "./masks";

export function validateCPF(value: string): boolean {
  const digits = cleanCPF(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const nums = digits.split("").map(Number);

  const sum1 = nums.slice(0, 9).reduce((acc, d, i) => acc + d * (10 - i), 0);
  const mod1 = sum1 % 11;
  const d1 = mod1 < 2 ? 0 : 11 - mod1;
  if (d1 !== nums[9]) return false;

  const sum2 = nums.slice(0, 10).reduce((acc, d, i) => acc + d * (11 - i), 0);
  const mod2 = sum2 % 11;
  const d2 = mod2 < 2 ? 0 : 11 - mod2;
  if (d2 !== nums[10]) return false;

  return true;
}

export function calculateAge(birthDateIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateIso)) return null;
  const [y, m, d] = birthDateIso.split("-").map(Number);
  const birth = new Date(y, m - 1, d);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function isMinor(birthDateIso: string): boolean {
  const age = calculateAge(birthDateIso);
  return age !== null && age < 18;
}

export function isValidBirthDate(birthDateIso: string): boolean {
  const age = calculateAge(birthDateIso);
  if (age === null) return false;
  if (age < 0) return false;
  if (age > 130) return false;
  return true;
}
