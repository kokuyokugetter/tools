const format = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 3 }).format;
const number = (name, label, min = 0, step = 'any', value) => ({ name, label, type: 'number', min, step, value });
const time = (name, label) => ({ name, label, type: 'time' });
const clockMinutes = (value) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};
const duration = (minutes) => `${Math.floor(minutes / 60)}時間${minutes % 60}分`;

export const dailyTools = [
  {
    id: 'recipe-scaling', name: 'レシピの分量を変える', category: '料理',
    description: '2人分のレシピを4人分にするなど、必要な材料の量をまとめて計算。',
    keywords: '料理 りょうり 分量 人数 倍量 半量 食材 材料',
    mount(form, output, controlFor) {
      const originalLabel = controlFor(number('original', '元のレシピは何人分？', 1, 1));
      const desiredLabel = controlFor(number('desired', '何人分作る？', 1, 1));
      const original = originalLabel.querySelector('input');
      const desired = desiredLabel.querySelector('input');
      const list = document.createElement('div');
      list.className = 'field-wide ingredient-list';
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'add-product';
      add.textContent = '＋ 材料を追加';
      form.append(originalLabel, desiredLabel, list, add);

      function update() {
        if (!original.validity.valid || !desired.validity.valid || !original.value || !desired.value) {
          output.textContent = '元の人数と、作りたい人数を入力してください。';
          return;
        }
        const result = [];
        let incomplete = false;
        for (const row of list.children) {
          const [name, quantity, unit] = row.querySelectorAll('input');
          if (!name.value.trim() && !quantity.value && !quantity.validity.badInput && !unit.value.trim()) continue;
          const amount = quantity.valueAsNumber * (desired.valueAsNumber / original.valueAsNumber);
          if (!quantity.validity.valid || !Number.isFinite(amount)) {
            incomplete = true;
            continue;
          }
          result.push(`${name.value.trim() || row.querySelector('legend').textContent}　${format(amount)} ${unit.value.trim()}`.trimEnd());
        }
        if (incomplete) result.push('量を入力していない材料があります。');
        output.textContent = result.length ? [`${format(desired.valueAsNumber)}人分の分量`, ...result].join('\n') : '材料の量を入力してください。';
      }

      let nextIngredient = 1;
      function addIngredient(focus = false) {
        const row = document.createElement('fieldset');
        const legend = document.createElement('legend');
        legend.textContent = '材料' + nextIngredient++;
        const name = controlFor({ name: 'ingredient', label: '材料名', type: 'text', placeholder: '小麦粉' });
        const quantity = controlFor(number('quantity', '量'));
        const unit = controlFor({ name: 'unit', label: '単位', type: 'text', placeholder: 'g' });
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '削除';
        remove.setAttribute('aria-label', legend.textContent + 'を削除');
        remove.addEventListener('click', () => {
          row.remove();
          update();
          add.focus();
        });
        row.append(legend, name, quantity, unit, remove);
        list.append(row);
        if (focus) name.querySelector('input').focus();
      }
      add.addEventListener('click', () => addIngredient(true));
      form.addEventListener('input', update);
      addIngredient();
      update();
    },
  },
  {
    id: 'work-hours', name: '勤務時間・残業時間', category: 'お金・仕事',
    description: '出勤・退勤と休憩から実働を計算。退勤が出勤より早い時刻なら翌日、同じ時刻なら0時間として扱います。',
    keywords: '勤怠 しごと バイト 時間 給与 夜勤 休憩 シフト',
    fields: [time('start', '出勤時刻'), time('end', '退勤時刻'),
      number('breakTime', '休憩（分）', 0, 1, 60),
      number('regular', '所定の勤務時間（時間）', 0, 'any', 8)],
    calculate({ start, end, breakTime, regular }) {
      if (!start || !end || breakTime === undefined || regular === undefined) return '出勤・退勤時刻、休憩、所定の勤務時間を入力してください。';
      const elapsed = clockMinutes(end) - clockMinutes(start);
      const working = (elapsed + 1440) % 1440 - breakTime;
      if (working < 0) return '休憩が出勤から退勤までの時間より長くなっています。';
      const overtime = Math.max(0, working - Math.round(regular * 60));
      return `実働 ${duration(working)}\n所定を超えた時間 ${duration(overtime)}${elapsed < 0 ? '\n退勤は翌日として計算しました。' : ''}`;
    },
  },
  {
    id: 'split-bill', name: '割り勘', category: 'お金・仕事',
    description: '会計を人数で分けます。1円単位でぴったりになる分け方も表示。',
    keywords: 'わりかん 支払い 立替 飲み会 食事 誕生日 ひとり 1人',
    fields: [number('total', '合計（円）', 0, 1), number('people', '人数', 1, 1)],
    calculate({ total, people }) {
      if (!Number.isSafeInteger(total) || !Number.isSafeInteger(people)) return '合計と人数を整数で入力してください。';
      const remainder = total % people;
      const share = Math.floor(total / people);
      return remainder
        ? `${format(remainder)}人が${format(share + 1)}円、${format(people - remainder)}人が${format(share)}円`
        : `1人あたり ${format(share)}円`;
    },
  },
  {
    id: 'allowance', name: 'おこづかい、あといくら？', category: 'お金・仕事',
    description: '持っているお金から、買うものの値段を引いて、残りを確認。',
    keywords: 'お小遣い 予算 残高 足りる たりる いくら おつり',
    fields: [number('budget', '持っているお金（円）', 0, 1), number('cost', '買いたいものの合計（円）', 0, 1)],
    calculate({ budget, cost }) {
      if (!Number.isSafeInteger(budget) || !Number.isSafeInteger(cost)) return '持っているお金と、買いたいものの合計を入力してください。';
      const balance = budget - cost;
      return balance >= 0 ? `残りは ${format(balance)}円です。` : `あと ${format(-balance)}円あれば買えます。`;
    },
  },
];
