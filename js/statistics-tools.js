function dataRows(input, limit) {
  const rows = String(input ?? '').trim().split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (rows.length > limit) throw new Error(`データは ${limit} 行以内で入力してください。`);
  return rows;
}

function number(input, label) {
  const text = String(input ?? '').trim();
  const value = Number(text);
  if (!text || !Number.isFinite(value) || Math.abs(value) > 1e100) {
    throw new Error(`${label}に有限の数値（絶対値 10¹⁰⁰ 以下）を入力してください。`);
  }
  return value;
}

function integer(input, label, min, max) {
  const value = number(input, label);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}は ${min}～${max} の整数を入力してください。`);
  }
  return value;
}

function seededRandom(input) {
  let state = integer(input, '乱数シード', 1, 4294967295);
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return (state + 0.5) / 4294967296;
  };
}

function format(value) {
  const magnitude = Math.abs(value);
  if (magnitude && (magnitude < 0.0001 || magnitude >= 1e9)) return value.toExponential(6);
  return value.toLocaleString('ja-JP', { maximumSignificantDigits: 7 });
}

function quantile(sorted, probability) {
  const index = probability * (sorted.length - 1);
  const lower = Math.floor(index);
  return sorted[lower] + (sorted[Math.ceil(index)] - sorted[lower]) * (index - lower);
}

function average(values) {
  let sum = 0;
  let compensation = 0;
  for (const value of values) {
    const corrected = value - compensation;
    const next = sum + corrected;
    compensation = (next - sum) - corrected;
    sum = next;
  }
  return sum / values.length;
}

function bootstrap({ observations, method, confidence, iterations, seed }) {
  const source = dataRows(observations, 2000).join(' ').split(/[\s,]+/).filter(Boolean);
  if (source.length < 3 || source.length > 2000) throw new Error('観測値を 3～2000 個入力してください。');
  const data = source.map((value, index) => number(value, `${index + 1} 番目の観測値`));
  const count = integer(iterations, '再標本化回数', 200, 20000);
  const level = number(confidence, '信頼水準');
  if (level < 50 || level > 99.9) throw new Error('信頼水準は 50～99.9% で入力してください。');
  const median = method === 'median';
  const estimate = median ? values => quantile(values.sort((a, b) => a - b), 0.5) : average;
  const work = count * data.length * (median ? Math.log2(data.length) : 1);
  if (work > 30000000) throw new Error('入力数または再標本化回数を減らしてください。');
  const random = seededRandom(seed);
  const distribution = new Float64Array(count);
  const sample = new Float64Array(data.length);
  for (let iteration = 0; iteration < count; iteration++) {
    for (let index = 0; index < sample.length; index++) {
      sample[index] = data[Math.floor(random() * data.length)];
    }
    distribution[iteration] = estimate(sample);
  }
  distribution.sort();
  const tail = (1 - level / 100) / 2;
  return {
    text: [
      `${median ? '中央値' : '平均値'} ${format(estimate(data))}`,
      `${level}% 信頼区間 ${format(quantile(distribution, tail))} ～ ${format(quantile(distribution, 1 - tail))}`,
      `観測数 ${data.length} / 再標本化 ${count.toLocaleString()} 回`,
    ].join('\n'),
    detail: '観測数と同じ件数を復元抽出し、統計量のパーセンタイルで区間を推定します。各観測の独立性を仮定します。小標本や極端に偏った分布では区間の被覆率が公称値からずれることがあります。',
  };
}

function projectForecast({ tasks, iterations, deadline, seed }) {
  const rows = dataRows(tasks, 160);
  if (!rows.length) throw new Error('タスクを 1 件以上入力してください。');
  const taskById = new Map();
  let edgeCount = 0;
  rows.forEach((row, index) => {
    const [id, low, mode, high, dependencies = '', ...extra] = row.split(',').map(value => value.trim());
    const label = `${index + 1} 行目`;
    if (!/^[\p{L}\p{N}_-]+$/u.test(id) || high === undefined || extra.length) {
      throw new Error(`${label}は「ID,最短,最頻,最長,前提ID」の形式で入力してください。`);
    }
    if (taskById.has(id)) throw new Error(`ID「${id}」が重複しています。`);
    const min = number(low, `${label}の最短`);
    const likely = number(mode, `${label}の最頻`);
    const max = number(high, `${label}の最長`);
    if (min < 0 || min > likely || likely > max) throw new Error(`${label}は 0 ≤ 最短 ≤ 最頻 ≤ 最長 にしてください。`);
    const predecessors = [...new Set(dependencies.split(/\s+/).filter(Boolean))];
    edgeCount += predecessors.length;
    if (edgeCount > 3000) throw new Error('前提関係は 3000 件以内で入力してください。');
    taskById.set(id, { id, min, likely, max, dependencies: predecessors });
  });
  const ordered = [];
  const visiting = new Set();
  const positions = new Map();
  function visit(id) {
    if (positions.has(id)) return positions.get(id);
    if (visiting.has(id)) throw new Error(`「${id}」を含む前提関係が循環しています。`);
    const task = taskById.get(id);
    if (!task) throw new Error(`前提 ID「${id}」が見つかりません。`);
    visiting.add(id);
    const predecessors = task.dependencies.map(visit);
    visiting.delete(id);
    const position = ordered.length;
    ordered.push({ ...task, predecessors });
    positions.set(id, position);
    return position;
  }
  taskById.forEach(task => visit(task.id));
  const count = integer(iterations, '試行回数', 200, 30000);
  if (count * (ordered.length + edgeCount) > 15000000) throw new Error('試行回数を減らしてください。');
  const target = String(deadline ?? '').trim() ? number(deadline, '目標日数') : null;
  if (target !== null && target < 0) throw new Error('目標日数は 0 以上で入力してください。');
  const random = seededRandom(seed);
  const results = new Float64Array(count);
  const finishes = new Float64Array(ordered.length);
  let onTime = 0;
  for (let iteration = 0; iteration < count; iteration++) {
    let projectEnd = 0;
    for (let index = 0; index < ordered.length; index++) {
      const { min, likely, max, predecessors } = ordered[index];
      let start = 0;
      for (const predecessor of predecessors) start = Math.max(start, finishes[predecessor]);
      const uniform = random();
      const width = max - min;
      let duration = min;
      if (width > 0) {
        duration = uniform < (likely - min) / width
          ? min + Math.sqrt(uniform * width * (likely - min))
          : max - Math.sqrt((1 - uniform) * width * (max - likely));
      }
      finishes[index] = start + duration;
      projectEnd = Math.max(projectEnd, finishes[index]);
    }
    results[iteration] = projectEnd;
    if (target !== null && projectEnd <= target) onTime++;
  }
  results.sort();
  const lines = [0.5, 0.8, 0.9].map(probability =>
    `P${probability * 100} 完了日数 ${format(quantile(results, probability))} 日`);
  if (target !== null) lines.push(`${format(target)} 日以内に完了する割合 ${format(onTime * 100 / count)}%`);
  lines.push(`タスク ${ordered.length} 件 / 試行 ${count.toLocaleString()} 回`);
  return {
    text: lines.join('\n'),
    detail: '各タスクの日数を独立な三角分布から抽出します。前提タスクがすべて終わると着手できます。担当者の重複や共通要因による遅延はモデルに含まれません。P80 は試行結果の約 80% がその日数以内に完了したことを示します。',
  };
}

function regression({ pairs, predict }) {
  const rows = dataRows(pairs, 10000);
  if (rows.length < 3) throw new Error('データを 3 組以上入力してください。');
  const points = rows.map((row, index) => {
    const columns = row.split(',').map(value => value.trim());
    if (columns.length !== 2) throw new Error(`${index + 1} 行目は「X,Y」の形式で入力してください。`);
    return columns.map((value, column) => number(value, `${index + 1} 行目の ${column ? 'Y' : 'X'}`));
  });
  const xs = points.map(point => point[0]);
  const ys = points.map(point => point[1]);
  const originX = xs[0];
  const originY = ys[0];
  const offsetX = average(xs.map(x => x - originX));
  const offsetY = average(ys.map(y => y - originY));
  const centeredX = xs.map(x => (x - originX) - offsetX);
  const centeredY = ys.map(y => (y - originY) - offsetY);
  const scaleX = centeredX.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const scaleY = centeredY.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  if (!scaleX) throw new Error('X に異なる値を 2 個以上入力してください。');
  const normalizedX = centeredX.map(value => value / scaleX);
  const normalizedY = scaleY ? centeredY.map(value => value / scaleY) : centeredY;
  const cross = average(normalizedX.map((x, index) => x * normalizedY[index]));
  const varianceX = average(normalizedX.map(x => x * x));
  const varianceY = average(normalizedY.map(y => y * y));
  const normalizedSlope = cross / varianceX;
  const slope = normalizedSlope * scaleY / scaleX;
  const fitted = x => {
    if (!normalizedSlope) return originY + offsetY;
    return originY + (offsetY + normalizedSlope * (((x - originX) - offsetX) / scaleX) * scaleY);
  };
  const intercept = fitted(0);
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) throw new Error('回帰係数が計算範囲を超えました。');
  const residuals = normalizedY.map((y, index) => y - normalizedSlope * normalizedX[index]);
  const meanSquaredError = average(residuals.map(value => value * value));
  const rSquared = varianceY ? Math.max(0, 1 - meanSquaredError / varianceY) : null;
  const rmse = Math.sqrt(meanSquaredError) * scaleY;
  const lines = [
    `傾き ${format(slope)} / 切片 ${format(intercept)}`,
    `決定係数 R² ${rSquared === null ? '算出不可（Y が一定）' : format(rSquared)}`,
    `RMSE ${format(rmse)} / 観測数 ${points.length.toLocaleString()}`,
  ];
  if (String(predict ?? '').trim()) {
    const x = number(predict, '予測 X');
    const prediction = fitted(x);
    if (!Number.isFinite(prediction)) throw new Error('予測値が計算範囲を超えました。');
    const outside = x < Math.min(...xs) || x > Math.max(...xs);
    lines.push(`X = ${format(x)} の予測値 ${format(prediction)}${outside ? '（観測範囲外）' : ''}`);
  }
  const csv = points.map(([x, y], index) => [x, y, fitted(x), residuals[index] * scaleY].join(','));
  return {
    text: lines.join('\n'),
    detail: '切片を含む最小二乗直線です。RMSE は観測データに対する残差の二乗平均平方根です。CSV に実測値・予測値・残差を出力します。',
    artifact: { filename: 'linear-regression.csv', text: ['X,Y,Fitted,Residual', ...csv].join('\n') },
  };
}

const field = (name, label, type, value) => ({ name, label, type, value });
const numericField = (name, label, value, step = 'any') => ({ ...field(name, label, 'number', value), step });
const seedField = numericField('seed', '乱数シード', '42', 1);

export const statisticsTools = [
  {
    id: 'project-monte-carlo',
    name: 'プロジェクト完了日のモンテカルロ予測',
    category: '統計・シミュレーション',
    description: 'タスクの日数と前提関係から、完了までの P50・P80・P90 と目標日数内の完了率を推定します。',
    keywords: 'PERT Monte Carlo 工程 クリティカルパス 三角分布 スケジュール',
    fields: [
      field('tasks', 'タスク（ID,最短,最頻,最長,前提ID。前提が複数なら空白区切り）', 'textarea',
        '設計,2,4,7\n実装,4,6,10,設計\n準備,1,3,5,設計\n検証,2,3,6,実装 準備'),
      numericField('deadline', '目標日数（任意）', '15'),
      numericField('iterations', '試行回数', '10000', 1),
      seedField,
    ],
    calculate: projectForecast,
  },
  {
    id: 'bootstrap-interval',
    name: 'ブートストラップ信頼区間',
    category: '統計・シミュレーション',
    description: '観測データから平均値または中央値のパーセンタイル信頼区間を推定します。',
    keywords: 'bootstrap 再標本化 推定 区間 平均 中央値',
    fields: [
      field('observations', '観測値（空白・改行・カンマ区切り）', 'textarea', '9, 11, 10, 8, 13, 11, 12, 15, 14, 10, 17, 9'),
      { ...field('method', '統計量', 'text', 'mean'), choices: [['mean', '平均値'], ['median', '中央値']] },
      numericField('confidence', '信頼水準（%）', '95'),
      numericField('iterations', '再標本化回数', '5000', 1),
      seedField,
    ],
    calculate: bootstrap,
  },
  {
    id: 'linear-regression',
    name: '単回帰と残差分析',
    category: '統計・シミュレーション',
    description: 'X と Y の観測値に直線を当てはめ、傾き、決定係数、予測値、残差を確認します。',
    keywords: 'linear regression least squares 最小二乗 回帰 予測 決定係数 CSV',
    fields: [
      field('pairs', '観測値（各行に X,Y。見出し行なし）', 'textarea', '1,4\n2,5\n3,7\n4,9\n5,10\n6,13'),
      numericField('predict', '予測する X（任意）', '7'),
    ],
    calculate: regression,
  },
];
