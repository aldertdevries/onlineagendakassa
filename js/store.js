const KEY = 'akp-data-v2';
const COLLECTIONS = [
  'companies', 'customers', 'calendars', 'openingHours',
  'blocks', 'appointments', 'invoices', 'mails', 'accessCodes',
];

function emptyData() {
  const d = { nextId: 1 };
  for (const c of COLLECTIONS) d[c] = [];
  return d;
}

export function createStore(storage) {
  let data;
  const rawStr = storage.getItem(KEY);
  data = rawStr ? JSON.parse(rawStr) : emptyData();

  function save() {
    storage.setItem(KEY, JSON.stringify(data));
  }

  const store = {
    reset() {
      data = emptyData();
      save();
    },
    raw() {
      return data;
    },
  };

  for (const name of COLLECTIONS) {
    store[name] = {
      all: () => data[name].slice(),
      get: id => data[name].find(x => x.id === id),
      where: fn => data[name].filter(fn),
      create(obj) {
        const rec = { ...obj, id: data.nextId++ };
        data[name].push(rec);
        save();
        return rec;
      },
      update(id, patch) {
        const rec = data[name].find(x => x.id === id);
        Object.assign(rec, patch);
        save();
        return rec;
      },
      remove(id) {
        data[name] = data[name].filter(x => x.id !== id);
        save();
      },
    };
  }
  return store;
}
