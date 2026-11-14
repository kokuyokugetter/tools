const number = (name, label, options = {}) => ({ name, label, type: 'number', step: 'any', ...options });
const date = (name, label) => ({ name, label, type: 'date' });

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
    id: 'year-relations', name: '西暦・和暦と年齢', category: '日付・単位',
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
    id: 'inch-centi', name: 'インチ・センチ変換', category: '日付・単位',
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
    id: 'date-difference', name: 'あと何日？ 日にちの間隔', category: '日付・単位',
    description: 'ふたつの日付の間の日数を計算。',
    keywords: 'date days 何日 期間 日付差 経過 あと何日 たんじょうび 誕生日 いつまで 夏休み',
    fields: [{ ...date('start', 'いつから？'), value: todayValue }, date('end', 'いつまで？')],
    calculate({ start, end }) {
      if (!start || !end) return '2つの日付を入力してください。';
      const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
      return Number.isFinite(days)
        ? `${days < 0 ? '2つ目の日付は' : '2つ目の日付まで'} ${format(Math.abs(days))}日${days < 0 ? '前' : ''}\n最初と最後の日を両方数えると ${format(Math.abs(days) + 1)}日`
        : '日付を確認してください。';
    },
  },
  {
    id: 'discount', name: '割引後はいくら？', category: '買い物',
    description: '元の価格と割引率から、支払額と値引き額を計算。',
    keywords: 'セール 値引き 割引き わりびき 何割引 price off 買い物',
    fields: [number('price', '元の価格（円）', { min: 0 }), number('rate', '割引率（例：2割引なら20%）', { min: 0, max: 100 })],
    calculate({ price, rate }) {
      if (price === undefined || rate === undefined) return '価格と0〜100%の割引率を入力してください。';
      const saving = price * (rate / 100);
      return `支払う金額 ${format(price - saving, 2)}円\n値引き額 ${format(saving, 2)}円`;
    },
  },
];
