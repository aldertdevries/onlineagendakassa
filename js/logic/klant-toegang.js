// Pure logica voor de klantpagina per bedrijf: invoervalidatie bij het boeken,
// klant-matching binnen een bedrijf, publieke bedrijfs-ID's en toegangscodes.

export const CODE_GELDIG_MINUTEN = 10;
export const CODE_MAX_POGINGEN = 3;

export function normalizePhone(input) {
  const s = String(input || '').replace(/[\s-]/g, '');
  if (/^\+31[1-9]\d{8}$/.test(s)) return s;
  if (/^0[1-9]\d{8}$/.test(s)) return '+31' + s.slice(1);
  return null;
}

export function validateKlantGegevens({ name, email, phone }) {
  const errors = {};
  if (!String(name || '').trim()) errors.name = 'Vul je naam in.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '')))
    errors.email = 'Vul een geldig e-mailadres in.';
  if (!normalizePhone(phone))
    errors.phone = 'Vul een geldig Nederlands telefoonnummer in (06… of +316…).';
  return { ok: Object.keys(errors).length === 0, errors };
}

export function findCustomer(customers, companyId, email, phone) {
  const mail = String(email || '').trim().toLowerCase();
  const tel = normalizePhone(phone);
  return customers.find(c => c.companyId === companyId &&
    ((mail && c.email.toLowerCase() === mail) || (tel && c.phone === tel))) || null;
}

// Alfabet zonder verwarrende tekens (geen 0/o, 1/l/i).
export function makePublicId(rand = Math.random) {
  const alfabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += alfabet[Math.floor(rand() * alfabet.length)];
  return id;
}

export function checkAccessCode(rec, input, now) {
  if (!rec) return { ok: false, reason: 'Vraag eerst een code aan.' };
  if (now > rec.expiresAt)
    return { ok: false, reason: 'De code is verlopen. Vraag een nieuwe aan.' };
  if (rec.attempts >= CODE_MAX_POGINGEN)
    return { ok: false, reason: 'Te veel pogingen. Vraag een nieuwe code aan.' };
  if (String(input).trim() !== rec.code)
    return { ok: false, reason: 'Onjuiste code.', telPoging: true };
  return { ok: true };
}
