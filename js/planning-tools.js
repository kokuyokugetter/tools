const MAX_INPUT = 100_000;

function inputLines(input) {
  if (input.length > MAX_INPUT) throw new Error('入力は10万文字以内にしてください。');
  return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function integer(input, label, min, max) {
  const value = Number(input);
  if (!/^\d+$/.test(String(input).trim()) || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${label}は${min}〜${max}の整数にしてください。`);
  }
  return value;
}

function cuttingPlan({ stock, kerf, pieces }) {
  const length = integer(stock, '母材長', 1, 1_000_000);
  const loss = integer(kerf, '切りしろ', 0, 1_000_000);
  // Charge kerf only between pieces. One extra kerf in the bin capacity cancels the final charge.
  const capacity = length + loss;
  const sizes = [];
  for (const line of inputLines(pieces)) {
    const [rawSize, rawCount = '1', ...extra] = line.split(/[\s,×x]+/);
    if (extra.length) throw new Error('各行を「長さ 数量」の形式で入力してください。');
    const size = integer(rawSize, '部材長', 1, length);
    const count = integer(rawCount, '数量', 1, 2000);
    if (sizes.length + count > 2000) throw new Error('部材は合計2,000個以内にしてください。');
    for (let i = 0; i < count; i++) sizes.push(size);
  }
  if (!sizes.length) throw new Error('部材を入力してください。');
  sizes.sort((a, b) => b - a);
  const weights = sizes.map((size) => size + loss);
  const estimate = [];
  for (const weight of weights) {
    let best;
    for (const bin of estimate) {
      if (bin.free >= weight && (!best || bin.free < best.free)) best = bin;
    }
    if (!best) {
      best = { free: capacity, pieces: [] };
      estimate.push(best);
    }
    best.free -= weight;
    best.pieces.push(weight - loss);
  }

  let plan = estimate;
  let lower = Math.max(
    Math.ceil(weights.reduce((sum, weight) => sum + weight, 0) / capacity),
    weights.filter((weight) => weight * 2 > capacity).length,
  );
  let visited = 0;
  let interrupted = false;
  if (sizes.length <= 60) {
    for (let count = lower; count < plan.length; count++) {
      const bins = Array.from({ length: count }, () => ({ free: capacity, pieces: [] }));
      function place(index) {
        if (index === weights.length) return true;
        if (++visited > 250_000) {
          interrupted = true;
          return false;
        }
        const weight = weights[index];
        const tried = new Set();
        for (const bin of bins) {
          if (bin.free < weight || tried.has(bin.free)) continue;
          tried.add(bin.free);
          bin.free -= weight;
          bin.pieces.push(weight - loss);
          if (place(index + 1)) return true;
          bin.pieces.pop();
          bin.free += weight;
          if (interrupted) return false;
        }
        return false;
      }
      if (place(0)) {
        plan = bins;
        break;
      }
      if (interrupted) break;
      lower = count + 1;
    }
  }
  const rows = plan.map(({ free, pieces }, index) => `${index + 1}\t${pieces.join(' + ')}\t${free}`);
  const optimal = lower === plan.length;
  const kerfTotal = (sizes.length - plan.length) * loss;
  const remaining = plan.reduce((sum, bin) => sum + bin.free, 0);
  return {
    text: `母材 ${plan.length}本（${optimal ? '最少本数を確認' : `暫定解・理論下限 ${lower}本`}）\n部材 ${sizes.length}個 / 切りしろ合計 ${kerfTotal} / 残材合計 ${remaining}`,
    detail: `母材番号\t部材長\t残材長\n${rows.join('\n')}`,
    artifact: { filename: 'cutting-plan.tsv', text: `母材番号\t部材長\t残材長\n${rows.join('\n')}` },
  };
}

function amount(input) {
  const match = /^([+-]?)(\d{1,10})(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) throw new Error('金額は整数部10桁以内、小数点以下2桁以内で入力してください。');
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 100 + Number((match[3] || '').padEnd(2, '0')));
}

function formatAmount(cents) {
  return (cents / 100).toFixed(2);
}

function matchAmounts({ target, entries }) {
  const goal = amount(target);
  const rows = inputLines(entries).map((line, index) => {
    const fields = line.split(/[,\t]/);
    if (fields.length > 2) throw new Error('各行を「金額」または「項目名,金額」で入力してください。');
    return { label: fields.length === 2 ? fields[0].trim() : `明細${index + 1}`, value: amount(fields.at(-1)) };
  });
  if (!rows.length || rows.length > 36) throw new Error('明細は1〜36件で入力してください。');

  function enumerate(part) {
    const subsets = [{ sum: 0, mask: 0, count: 0 }];
    for (const [index, { value }] of part.entries()) {
      const size = subsets.length;
      for (let i = 0; i < size; i++) {
        const subset = subsets[i];
        subsets.push({ sum: subset.sum + value, mask: subset.mask | (1 << index), count: subset.count + 1 });
      }
    }
    return subsets;
  }

  const middle = Math.floor(rows.length / 2);
  const left = enumerate(rows.slice(0, middle));
  const right = enumerate(rows.slice(middle)).sort((a, b) => a.sum - b.sum || a.count - b.count);
  // The empty subset stays available, but a match must contain at least one entry.
  const nonempty = right.filter((subset) => subset.count);
  let best;
  for (const first of left) {
    const candidates = first.count ? right : nonempty;
    const wanted = goal - first.sum;
    let low = 0;
    let high = candidates.length;
    while (low < high) {
      const index = (low + high) >>> 1;
      if (candidates[index].sum < wanted) low = index + 1;
      else high = index;
    }
    if (low > 0) {
      const previousSum = candidates[low - 1].sum;
      let start = 0;
      let end = low;
      while (start < end) {
        const index = (start + end) >>> 1;
        if (candidates[index].sum < previousSum) start = index + 1;
        else end = index;
      }
      consider(candidates[start]);
    }
    if (low < candidates.length) consider(candidates[low]);

    function consider(second) {
      const sum = first.sum + second.sum;
      const difference = Math.abs(sum - goal);
      const count = first.count + second.count;
      if (!best || difference < best.difference || (difference === best.difference && count < best.count)) {
        best = { first, second, sum, count, difference };
      }
    }
  }
  const selected = rows.filter((_, index) => index < middle
    ? best.first.mask & (1 << index)
    : best.second.mask & (1 << (index - middle)));
  return {
    text: `${best.difference === 0 ? '完全一致' : '最も近い組み合わせ'}（${best.count}件）\n合計 ${formatAmount(best.sum)} / 目標 ${formatAmount(goal)} / 差額（合計 − 目標） ${formatAmount(best.sum - goal)}`,
    detail: selected.map(({ label, value }) => `${label}\t${formatAmount(value)}`).join('\n'),
  };
}

function criticalPath({ tasks }) {
  const lines = inputLines(tasks);
  if (!lines.length || lines.length > 3000) throw new Error('タスクは1〜3,000件で入力してください。');
  const graph = new Map();
  for (const line of lines) {
    const fields = line.split(',').map((field) => field.trim());
    const [id, rawDuration, ...dependencies] = fields;
    if (!id || fields.length < 2 || id.includes('\t')) throw new Error('各行を「タスク名,所要日数,前提タスク…」の形式で入力してください。');
    if (graph.has(id)) throw new Error(`タスク名「${id}」が重複しています。`);
    const duration = integer(rawDuration, `「${id}」の所要日数`, 0, 1_000_000);
    graph.set(id, { id, duration, dependencies: [...new Set(dependencies.filter(Boolean))], children: [], start: 0 });
  }
  const queue = [];
  for (const task of graph.values()) {
    task.pending = task.dependencies.length;
    if (!task.pending) queue.push(task);
    for (const id of task.dependencies) {
      const dependency = graph.get(id);
      if (!dependency) throw new Error(`「${task.id}」が未定義のタスク「${id}」に依存しています。`);
      dependency.children.push(task);
    }
  }
  let duration = 0;
  let lastTask;
  for (let i = 0; i < queue.length; i++) {
    const task = queue[i];
    task.finish = task.start + task.duration;
    if (!lastTask || task.finish >= duration) {
      duration = task.finish;
      lastTask = task;
    }
    for (const child of task.children) {
      if (!child.predecessor || child.start < task.finish) {
        child.start = task.finish;
        child.predecessor = task;
      }
      if (--child.pending === 0) queue.push(child);
    }
  }
  if (queue.length !== graph.size) {
    const pending = [...graph.values()].filter((task) => task.pending);
    throw new Error(`依存関係に循環があります。工程順を確定できないタスク ${pending.slice(0, 10).map(({ id }) => id).join('、')}${pending.length > 10 ? ' ほか' : ''}`);
  }
  for (let i = queue.length - 1; i >= 0; i--) {
    const task = queue[i];
    task.latestFinish = task.children.reduce((date, child) => Math.min(date, child.latestStart), duration);
    task.latestStart = task.latestFinish - task.duration;
  }
  const path = [];
  for (let task = lastTask; task; task = task.predecessor) path.push(task.id);
  const rows = queue.map((task) => [
    task.id, task.duration, task.start, task.finish, task.latestStart, task.latestFinish, task.latestStart - task.start,
  ]);
  const header = 'タスク\t所要日数\t最早開始\t最早終了\t最遅開始\t最遅終了\t余裕日数';
  const detail = [header, ...rows.map((row) => row.join('\t'))].join('\n');
  const tsv = [header, ...rows.map(([id, ...times]) => [
    /^[\s\u0000-\u001f]*[=+@-]|^"/u.test(id) ? "'" + id : id, ...times,
  ].join('\t'))].join('\n');
  return {
    text: `最短工期 ${duration}日（開始を0日目とする経過日数）\nクリティカルパスの一例 ${path.reverse().join(' → ')}`,
    detail,
    artifact: { filename: 'critical-path.tsv', text: tsv },
  };
}

export const planningTools = [
  {
    id: 'cutting-plan',
    name: '材料の切断計画',
    category: '最適化・計画',
    description: '必要な部材を母材に割り当てます。切りしろは隣接する部材間に計上します。',
    keywords: '切断 木材 パイプ 歩留まり ビンパッキング 一次元',
    fields: [
      { name: 'stock', label: '母材長', type: 'number', value: 3050 },
      { name: 'kerf', label: '部材間の切りしろ', type: 'number', value: 3 },
      { name: 'pieces', label: '部材（1行に長さと数量を空白区切り）', type: 'textarea', value: '1200 5\n850 4\n620 6\n300 8' },
    ],
    calculate: cuttingPlan,
  },
  {
    id: 'amount-matching',
    name: '金額の組み合わせ照合',
    category: '最適化・計画',
    description: '明細から目標金額に最も近い組み合わせを探します。同じ差額なら明細が少ない組み合わせを選びます。',
    keywords: '入金消込 経理 部分和 金額 精算',
    fields: [
      { name: 'target', label: '目標金額', type: 'text', value: '18925.50' },
      { name: 'entries', label: '明細（1行に項目名と金額をカンマ区切り、最大36件）', type: 'textarea', value: '請求A,12450\n請求B,6475.50\n請求C,5500\n請求D,3300\n調整,-500' },
    ],
    calculate: matchAmounts,
  },
  {
    id: 'critical-path',
    name: '工程表とクリティカルパス',
    category: '最適化・計画',
    description: '前提タスクから最短工期と各工程の余裕日数を算出します。依存関係のない作業は並行できます。',
    keywords: '工程表 プロジェクト スケジュール CPM 依存関係',
    fields: [
      { name: 'tasks', label: 'タスク（名前,所要日数,前提タスク名…）', type: 'textarea', value: '要件定義,3\n設計,4,要件定義\n環境準備,2,要件定義\n実装,6,設計,環境準備\nテスト,3,実装\n公開準備,2,設計\n公開,0,テスト,公開準備' },
    ],
    calculate: criticalPath,
  },
];
