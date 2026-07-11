export function calcTotals(lines) {
  let exclCents = 0;
  const vatByRate = {};
  for (const l of lines) {
    const lineExcl = Math.round(l.qty * l.unitPriceCents);
    exclCents += lineExcl;
    vatByRate[l.vatRate] = (vatByRate[l.vatRate] || 0) + Math.round(lineExcl * l.vatRate / 100);
  }
  const vatCents = Object.values(vatByRate).reduce((a, b) => a + b, 0);
  return { exclCents, vatCents, inclCents: exclCents + vatCents, vatByRate };
}

export function nextInvoiceNumber(existingNumbers, year) {
  const seq = existingNumbers
    .filter(n => n && n.startsWith(year + '-'))
    .map(n => parseInt(n.slice(5), 10));
  const next = (seq.length ? Math.max(...seq) : 0) + 1;
  return `${year}-${String(next).padStart(4, '0')}`;
}

export function creditLines(lines) {
  return lines.map(l => ({
    ...l,
    description: 'Creditering: ' + l.description,
    unitPriceCents: -l.unitPriceCents,
  }));
}
