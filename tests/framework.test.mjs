import { test, assertEqual, assertTrue } from './framework.mjs';

test('assertEqual vergelijkt via JSON', () => {
  assertEqual({ a: 1 }, { a: 1 });
});

test('assertTrue accepteert truthy', () => {
  assertTrue(1 === 1);
});
