const MS_PER_HOUR = 3_600_000;

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Vrai si la personne a au moins 18 ans à la date de référence (contrôle ARJEL). */
export function isAdult(birthDate: string | Date, reference: Date = new Date()): boolean {
  const d = toDate(birthDate);
  let age = reference.getFullYear() - d.getFullYear();
  const monthDiff = reference.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && reference.getDate() < d.getDate())) {
    age -= 1;
  }
  return age >= 18;
}

/** Ajoute un nombre d'heures à une date (utile pour la règle des 48h). */
export function addHours(date: string | Date, hours: number): Date {
  return new Date(toDate(date).getTime() + hours * MS_PER_HOUR);
}

/** Nombre d'heures (signé) entre maintenant et la date donnée. */
export function hoursUntil(date: string | Date, reference: Date = new Date()): number {
  return (toDate(date).getTime() - reference.getTime()) / MS_PER_HOUR;
}

/** Vrai si la date est passée (ou égale à la référence). */
export function isPast(date: string | Date, reference: Date = new Date()): boolean {
  return toDate(date).getTime() <= reference.getTime();
}
