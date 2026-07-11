import { test, assertEqual } from './framework.mjs';
import { calcTotals, nextInvoiceNumber, creditLines } from '../js/logic/invoices.js';

test('calcTotals telt per BTW-tarief', () => {
  const t = calcTotals([
    { description: 'Knippen', qty: 1, unitPriceCents: 3500, vatRate: 21 },
    { description: 'Shampoo', qty: 2, unitPriceCents: 750, vatRate: 9 },
  ]);
  assertEqual(t, { exclCents: 5000, vatCents: 870, inclCents: 5870, vatByRate: { 9: 135, 21: 735 } });
});

test('calcTotals met negatieve regels (creditnota)', () => {
  const t = calcTotals([{ description: 'Creditering: Knippen', qty: 1, unitPriceCents: -3500, vatRate: 21 }]);
  assertEqual(t.inclCents, -4235);
});

test('nextInvoiceNumber per jaar', () => {
  assertEqual(nextInvoiceNumber([], 2026), '2026-0001');
  assertEqual(nextInvoiceNumber(['2026-0001', '2026-0007', '2025-0042'], 2026), '2026-0008');
});

test('creditLines negeert prijs en labelt', () => {
  assertEqual(
    creditLines([{ description: 'Knippen', qty: 1, unitPriceCents: 3500, vatRate: 21 }]),
    [{ description: 'Creditering: Knippen', qty: 1, unitPriceCents: -3500, vatRate: 21 }]
  );
});
