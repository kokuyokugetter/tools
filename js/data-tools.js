const MAX_INPUT = 2_000_000;
const MAX_CSV_CELLS = 200_000;

function inputText(value) {
  const text = String(value ?? '').replace(/^\uFEFF/, '');
  if (text.length > MAX_INPUT) throw new Error('入力は200万文字以内にしてください。');
  return text;
}

function csvDelimiter(value) {
  return value === 'tab' ? '\t' : value === 'semicolon' ? ';' : ',';
}

function parseCsv(value, delimiter) {
  const text = inputText(value);
  const rows = [];
  let row = [];
  let field = '';
  let state = 'start';
  let cellCount = 0;

  function finishField() {
    cellCount++;
    if (cellCount > MAX_CSV_CELLS) throw new Error('CSVは20万セル以内にしてください。');
    row.push(field);
    field = '';
    state = 'start';
  }

  function finishRow() {
    finishField();
    rows.push(row);
    row = [];
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (state === 'quoted') {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i++;
      } else state = 'closed';
    } else if (char === delimiter) {
      finishField();
    } else if (char === '\r' || char === '\n') {
      finishRow();
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else if (char === '"' && state === 'start') {
      state = 'quoted';
    } else if (char === '"' || state === 'closed') {
      throw new Error(`CSVの${rows.length + 1}行目に不正な引用符があります。`);
    } else {
      state = 'plain';
      field += char;
    }
  }
  if (state === 'quoted') throw new Error('CSVの引用符が閉じられていません。');
  if (row.length || state !== 'start') finishRow();
  if (!rows.length) throw new Error('見出し付きのCSVを入力してください。');

  const [header, ...records] = rows;
  if (header.some(name => !name.trim()) || new Set(header).size !== header.length) {
    throw new Error('列名は空欄や重複がないようにしてください。');
  }
  for (const [index, record] of records.entries()) {
    if (record.length !== header.length) {
      throw new Error(`CSVの${index + 2}行目は見出しと列数が一致しません。`);
    }
  }
  return { header, records };
}

function csvOutput(rows) {
  let outputLength = 0;
  return rows.map(row => row.map(value => {
    let text = String(value);
    // Spreadsheet apps can evaluate CSV cells as formulas when opened.
    if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/u.test(text)) text = "'" + text;
    outputLength += text.length * 2 + 4;
    if (outputLength > 16_000_000) throw new Error('出力が大きすぎます。入力を分割してください。');
    return /[",\r\n]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
  }).join(',')).join('\r\n') + '\r\n';
}

function dataResult(summary, columns, rows, filename) {
  const preview = rows.slice(0, 100).map(row => row.map(value =>
    JSON.stringify(value).slice(0, 300)).join('\t'));
  return {
    text: rows.length > 100 ? `${summary}\n詳細は先頭100件を表示しています。` : summary,
    detail: [columns.join('\t'), ...preview].join('\n'),
    artifact: { filename, text: csvOutput([columns, ...rows]) },
  };
}

function delimiterField() {
  return {
    name: 'delimiter', label: '区切り文字', value: 'comma',
    choices: [['comma', 'カンマ'], ['tab', 'タブ'], ['semicolon', 'セミコロン']],
  };
}

function area(name, label, value) {
  return { name, label, type: 'textarea', value };
}

function profileCsv(values) {
  const { header, records } = parseCsv(values.csv, csvDelimiter(values.delimiter));
  const rows = header.map((name, column) => {
    let missing = 0;
    let numeric = 0;
    let min = Infinity;
    let max = -Infinity;
    let mean = 0;
    const unique = new Set();

    for (const record of records) {
      const cell = record[column];
      const trimmed = cell.trim();
      if (!trimmed) {
        missing++;
        continue;
      }
      unique.add(cell);
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) continue;
      const number = Number(trimmed);
      if (!Number.isFinite(number)) continue;
      numeric++;
      min = Math.min(min, number);
      max = Math.max(max, number);
      mean = mean * ((numeric - 1) / numeric) + number / numeric;
    }

    return [name, missing, unique.size, numeric, numeric ? min : '', numeric ? max : '', numeric ? mean : ''];
  });

  return dataResult(
    `${records.length}行 × ${header.length}列`,
    ['列名', '空欄', '異なる値の数', '数値の件数', '最小', '最大', '平均'],
    rows, 'csv-profile.csv',
  );
}

function keyedRecords(table, key, label) {
  const keyColumn = table.header.indexOf(key);
  if (keyColumn < 0) throw new Error(`${label}に指定したキー列がありません。`);
  const records = new Map();
  for (const record of table.records) {
    const id = record[keyColumn];
    if (!id.trim() || records.has(id)) throw new Error(`${label}のキー列に空欄または重複があります。`);
    records.set(id, record);
  }
  return records;
}

function compareCsv(values) {
  const delimiter = csvDelimiter(values.delimiter);
  const before = parseCsv(values.before, delimiter);
  const after = parseCsv(values.after, delimiter);
  const key = String(values.key ?? '');
  const left = keyedRecords(before, key, '変更前CSV');
  const right = keyedRecords(after, key, '変更後CSV');
  const rightIndexes = new Map(after.header.map((name, index) => [name, index]));
  const columns = before.header.map((name, index) => [name, index, rightIndexes.get(name)])
    .filter(([name, , rightIndex]) => name !== key && rightIndex >= 0);

  const rows = [];
  let added = 0;
  let removed = 0;
  let modified = 0;

  for (const [id, record] of left) {
    if (!right.has(id)) {
      removed++;
      rows.push(['行削除', id, '', '', '']);
      continue;
    }
    const newRecord = right.get(id);
    let changed = false;
    for (const [name, leftIndex, rightIndex] of columns) {
      if (record[leftIndex] === newRecord[rightIndex]) continue;
      changed = true;
      rows.push(['セル変更', id, name, record[leftIndex], newRecord[rightIndex]]);
    }
    if (changed) modified++;
  }

  for (const id of right.keys()) {
    if (left.has(id)) continue;
    added++;
    rows.push(['行追加', id, '', '', '']);
  }

  const leftNames = new Set(before.header);
  const rightNames = new Set(after.header);
  for (const name of before.header) if (!rightNames.has(name)) rows.push(['列削除', '', name, '', '']);
  for (const name of after.header) if (!leftNames.has(name)) rows.push(['列追加', '', name, '', '']);
  return dataResult(
    `追加 ${added}行 / 削除 ${removed}行 / 変更 ${modified}行（共通列の値を比較）`,
    ['種類', 'キー', '列名', '変更前', '変更後'],
    rows, 'csv-difference.csv',
  );
}

function indexJson(values) {
  let root;
  try {
    root = JSON.parse(inputText(values.json));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    throw new Error('JSONの形式を確認してください。');
  }

  const rows = [];
  let pathLength = 0;
  let pendingPathLength = 0;
  const pending = [{ value: root, path: '' }];
  while (pending.length) {
    const { value, path } = pending.pop();
    pendingPathLength -= path.length;
    const container = value !== null && typeof value === 'object';
    const array = Array.isArray(value);
    const type = value === null ? 'null' : array ? 'array' : typeof value;
    pathLength += path.length;
    if (rows.length >= 20_000 || pathLength > MAX_INPUT) {
      throw new Error('JSONの項目数またはパスの合計長が上限を超えています。');
    }
    if (!container) {
      rows.push([path, type, typeof value === 'string' ? value : String(value)]);
      continue;
    }
    const keys = Object.keys(value);
    if (rows.length + pending.length + keys.length >= 20_000) {
      throw new Error('JSONは2万項目以内にしてください。');
    }
    rows.push([path, type, keys.length]);
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i];
      const childPath = path + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
      pendingPathLength += childPath.length;
      if (pendingPathLength + pathLength > MAX_INPUT) {
        throw new Error('JSONパスの合計長が上限を超えています。');
      }
      pending.push({ value: value[key], path: childPath });
    }
  }

  return dataResult(
    `${rows.length}項目（空欄のJSON Pointerはルート）`,
    ['JSON Pointer', '型', '値または子要素数'],
    rows, 'json-paths.csv',
  );
}

function textLines(value) {
  const text = inputText(value);
  return text === '' ? [] : text.split(/\r\n|\r|\n/);
}

function diffText(values) {
  const before = textLines(values.before);
  const after = textLines(values.after);
  if (before.length + after.length > 20_000) throw new Error('前後のテキストは合計2万行以内にしてください。');

  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endBefore = before.length;
  let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) {
    endBefore--;
    endAfter--;
  }

  const height = endBefore - start + 1;
  const width = endAfter - start + 1;
  if (height * width > 4_000_000) throw new Error('差分の対象行が多すぎます。比較する範囲を分割してください。');
  const lcs = new Uint16Array(height * width);
  for (let i = height - 2; i >= 0; i--) {
    for (let j = width - 2; j >= 0; j--) {
      const index = i * width + j;
      lcs[index] = before[start + i] === after[start + j]
        ? 1 + lcs[index + width + 1]
        : Math.max(lcs[index + 1], lcs[index + width]);
    }
  }

  const rows = [];
  let added = 0;
  let removed = 0;
  let i = 0;
  let j = 0;
  while (i + 1 < height || j + 1 < width) {
    const oldLine = start + i;
    const newLine = start + j;
    const index = i * width + j;
    if (i + 1 < height && j + 1 < width && before[oldLine] === after[newLine]) {
      i++;
      j++;
    } else if (i + 1 < height && (j + 1 === width || lcs[index + width] >= lcs[index + 1])) {
      rows.push(['削除', oldLine + 1, '', before[oldLine]]);
      removed++;
      i++;
    } else {
      rows.push(['追加', '', newLine + 1, after[newLine]]);
      added++;
      j++;
    }
  }

  return dataResult(
    `追加 ${added}行 / 削除 ${removed}行 / 一致 ${before.length - removed}行`,
    ['種類', '変更前の行番号', '変更後の行番号', '内容'],
    rows, 'text-difference.csv',
  );
}

export const dataTools = [
  {
    id: 'csv-profile',
    name: 'CSVの列別集計',
    category: 'データ・テキスト',
    description: '列ごとに空欄、異なる値の数、数値の最小・最大・平均を確認します。',
    keywords: 'CSV TSV データ品質 欠損 統計 集計',
    fields: [
      area('csv', '見出し付きCSV', '部署,担当,金額\n営業,青木,3200\n制作,佐藤,5400\n営業,,2800'),
      delimiterField(),
    ],
    calculate: profileCsv,
  },
  {
    id: 'csv-compare',
    name: 'CSVの差分比較',
    category: 'データ・テキスト',
    description: 'キー列で行を対応させ、追加・削除と共通列で変わった値を一覧にします。',
    keywords: 'CSV TSV 差分 比較 更新 レコード キー',
    fields: [
      area('before', '変更前のCSV', 'ID,商品,在庫\nA01,ノート,8\nA02,ペン,12\nA03,封筒,7'),
      area('after', '変更後のCSV', 'ID,商品,在庫\nA01,ノート,5\nA03,封筒,7\nA04,付箋,20'),
      { name: 'key', label: 'キー列の見出し', type: 'text', value: 'ID' },
      delimiterField(),
    ],
    calculate: compareCsv,
  },
  {
    id: 'json-paths',
    name: 'JSONの項目一覧',
    category: 'データ・テキスト',
    description: 'ネストしたJSONから、各項目のJSON Pointerと型、値を一覧にします。',
    keywords: 'JSON Pointer パス 階層 配列 オブジェクト 変換',
    fields: [
      area('json', 'JSON', '{\n  "担当": "青木",\n  "タスク": [\n    {"名前": "確認", "完了": true},\n    {"名前": "集計", "完了": false}\n  ]\n}'),
    ],
    calculate: indexJson,
  },
  {
    id: 'text-diff',
    name: 'テキストの行差分',
    category: 'データ・テキスト',
    description: '2つのテキストを行単位で比較し、追加・削除された内容と行番号を表示します。',
    keywords: 'diff 差分 比較 テキスト 文章 行',
    fields: [
      area('before', '変更前のテキスト', '受付は10時開始\n会場は2階\n資料を受付で配布'),
      area('after', '変更後のテキスト', '受付は9時30分開始\n会場は2階\n資料を受付で配布\n筆記用具を持参'),
    ],
    calculate: diffText,
  },
];
