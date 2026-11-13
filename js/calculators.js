const number = (name, label, options = {}) => ({ name, label, type: 'number', step: 'any', ...options });
const date = (name, label) => ({ name, label, type: 'date' });
const select = (name, label, choices) => ({ name, label, choices });

const today = new Date();
const thisYear = today.getFullYear();
const todayValue = [thisYear, today.getMonth() + 1, today.getDate()]
  .map((part) => String(part).padStart(2, '0')).join('-');
const format = (value, digits = 6) => Number.isFinite(value)
  ? new Intl.NumberFormat('ja-JP', { maximumFractionDigits: digits }).format(value)
  : '計算範囲外';
const yearField = (name, label, value) => number(name, label, { min: 1, max: 9999, step: 1, value });

const eras = [
  [1868, '明治', '1868-10-23'],
  [1912, '大正', '1912-07-30'],
  [1926, '昭和', '1926-12-25'],
  [1989, '平成', '1989-01-08'],
  [2019, '令和', '2019-05-01'],
];
const zodiac = '申酉戌亥子丑寅卯辰巳午未';
const isLeap = (year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export const calculators = [
  {
    id: 'year-relations', name: '西暦・和暦と年齢', category: '日付',
    description: '元号、干支、うるう年、その年に迎える年齢。',
    keywords: '令和 平成 昭和 大正 明治 閏年 十二支 年齢 誕生日 早見 年号 calendar year age',
    fields: [yearField('year', '調べる西暦', thisYear), yearField('birth', '生まれ年（任意）')],
    calculate({ year, birth }) {
      if (!year) return '西暦を入力してください。';
      const start = eras.findLastIndex(([first]) => first <= year);
      const eraNames = [];
      if (start >= 0) {
        const [first, name, boundary] = eras[start];
        const previous = eras[start - 1];
        if (year === first && previous) {
          eraNames.push(previous[1] + (year - previous[0] + 1) + '年（' +
            boundary.slice(5).replace('-', '/') + 'に改元）');
        }
        eraNames.push(name + (year === first ? '元' : year - first + 1) + '年');
      }
      return [
        eraNames.join(' / ') || '明治より前の年です',
        `干支（十二支） ${zodiac[year % 12]}　·　${isLeap(year) ? 'うるう年' : '平年'}`,
        birth && (birth <= year ? `この年に ${year - birth}歳になります` : '生まれ年が調べる年より後です'),
      ].filter(Boolean).join('\n');
    },
  },
  {
    id: 'inch-centi', name: 'インチ・センチ変換', category: '単位',
    description: 'どちらの欄からでも換算。画面サイズや寸法に。',
    keywords: 'inch inches in cm センチメートル 長さ モニター',
    fields: [number('inch', 'インチ（in）', { value: 24 }), number('cm', 'センチ（cm）')],
    sync(form, changed) {
      const from = changed === 'cm' ? form.elements.cm : form.elements.inch;
      const to = changed === 'cm' ? form.elements.inch : form.elements.cm;
      const result = changed === 'cm' ? from.valueAsNumber / 2.54 : from.valueAsNumber * 2.54;
      to.value = Number.isFinite(result) ? Number(result.toPrecision(12)) : '';
    },
    calculate() { return '1 in = 2.54 cm'; },
  },
  {
    id: 'bmi', name: 'BMI計算', category: '単位',
    description: '身長と体重からBMIを計算。',
    keywords: 'bmi 身長 体重 kg cm',
    fields: [number('height', '身長（cm）'), number('weight', '体重（kg）')],
    calculate({ height, weight }) {
      return height > 0 && weight > 0
        ? `BMI ${format(weight / (height / 100) ** 2, 2)}`
        : '身長と体重を正の数で入力してください。';
    },
  },
  {
    id: 'date-difference', name: '日付の差・日数計算', category: '日付',
    description: 'ふたつの日付の間の日数を計算。',
    keywords: 'date days 何日 期間 日付差 経過 あと何日',
    fields: [{ ...date('start', '開始日'), value: todayValue }, date('end', '終了日')],
    calculate({ start, end }) {
      if (!start || !end) return '開始日と終了日を入力してください。';
      const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
      return Number.isFinite(days)
        ? `開始日から終了日まで ${format(days)}日\n両端を含めると ${format(Math.abs(days) + 1)}日`
        : '日付を確認してください。';
    },
  },
  {
    id: 'percentage', name: '割合・増減率', category: '計算',
    description: '全体に占める割合と、元の値からの増減率。',
    keywords: 'パーセント % percent ratio 比率 前年比',
    fields: [number('base', '基準の値'), number('value', '比較する値')],
    calculate({ base, value }) {
      if (base === undefined || value === undefined) return '2つの値を入力してください。';
      if (base === 0) return '基準が0のとき、割合と増減率は定義されません。';
      return `基準に対する割合 ${format(value / base * 100)}%\n基準からの増減率 ${format((value - base) / Math.abs(base) * 100)}%`;
    },
  },
  {
    id: 'discount', name: '割引計算', category: '計算',
    description: '元の価格と割引率から、支払額と値引き額を計算。',
    keywords: 'セール 値引き 割引き 何割引 price off 買い物',
    fields: [number('price', '元の価格（円）', { min: 0 }), number('rate', '割引率（%）', { min: 0, max: 100 })],
    calculate({ price, rate }) {
      if (price === undefined || rate === undefined) return '価格と0〜100%の割引率を入力してください。';
      const saving = price * (rate / 100);
      return `割引後 ${format(price - saving, 2)}円\n値引き額 ${format(saving, 2)}円`;
    },
  },
  {
    id: 'temperature', name: '温度変換', category: '単位',
    description: '摂氏と華氏を相互に換算。',
    keywords: '摂氏 華氏 celsius fahrenheit ℃ ℉ 料理',
    fields: [number('value', '温度'), select('unit', '入力単位', [['c', '摂氏（℃）'], ['f', '華氏（℉）']])],
    calculate({ value, unit }) {
      if (value === undefined) return '温度を入力してください。';
      return unit === 'c' ? `${format(value * 9 / 5 + 32)} ℉` : `${format((value - 32) * 5 / 9)} ℃`;
    },
  },
];
