import './framework.test.mjs';
import './store.test.mjs';
import './seed.test.mjs';
import './slots.test.mjs';
import './invoices.test.mjs';
import './status.test.mjs';
import { runAll } from './framework.mjs';

const { failed } = runAll();
process.exit(failed === 0 ? 0 : 1);
