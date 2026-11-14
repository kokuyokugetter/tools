const format = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 3 }).format;
const number = (name, label, min = 0, step = 'any', value) => ({ name, label, type: 'number', min, step, value });
const time = (name, label) => ({ name, label, type: 'time' });
const select = (name, label, choices) => ({ name, label, choices });
const watts = [200, 300, 500, 600, 700, 800, 900, 1000, 1200, 1500]
  .map(value => [String(value), value + 'W']);
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
    id: 'microwave-time', name: '電子レンジの時間換算', category: '料理',
    description: 'パッケージと家のレンジでワット数が違うときに、温め時間の目安を計算。',
    keywords: 'レンジ れんじ ワット W 温め 加熱 冷凍 弁当',
    fields: [
      { ...select('from', 'パッケージの出力', watts), value: '500' },
      { ...select('to', '使うレンジの出力', watts), value: '600' },
      { ...number('minutes', '表示時間（分）', 0, 1, 0), max: 120 },
      { ...number('seconds', '表示時間（秒）', 0, 1, 0), max: 59 },
    ],
    calculate({ from, to, minutes, seconds }) {
      if (minutes === undefined || seconds === undefined) return '分は0〜120、秒は0〜59の整数で入力してください。';
      const elapsed = minutes * 60 + seconds;
      if (elapsed <= 0) return 'パッケージの温め時間を入力してください。';
      const converted = Math.round(elapsed * Number(from) / Number(to));
      const time = converted === 0 ? '1秒未満' : `${Math.floor(converted / 60)}分${converted % 60}秒`;
      return `${to}Wで 約${time}（秒単位で四捨五入）\n食品の状態や機種で変わるため、パッケージやレンジの指示を優先してください。`;
    },
  },
  {
    id: 'hourly-pay', name: '時給から給料の目安', category: 'お金・仕事',
    description: '毎回の時給と実働が同じ場合に、控除前の基本給を見積もります。',
    keywords: '時給 バイト パート 給料 給与 シフト 実働 手取り前',
    fields: [
      { ...number('rate', '時給（円）', 1, 1), max: 100_000 },
      { ...number('hours', '1回の実働・休憩を除く（時間）', 0, 1, 0), max: 24 },
      { ...number('minutes', '実働の端数（分）', 0, 1, 0), max: 59 },
      { ...number('shifts', '勤務回数', 1, 1, 1), max: 366 },
    ],
    calculate({ rate, hours, minutes, shifts }) {
      if (hours === undefined || minutes === undefined) return '実働の時間は0〜24、分は0〜59の整数で入力してください。';
      const perShift = hours * 60 + minutes;
      if (!rate || !shifts || !perShift) return '時給・実働時間・勤務回数を入力してください。';
      if (perShift > 1440) return '1回の実働は24時間以内で入力してください。';
      const total = perShift * shifts;
      return `控除前の基本給 約${format(Math.round(rate * total / 60))}円（1円単位で四捨五入）\n実働合計 ${duration(total)}\n残業・深夜の割増や交通費は含めていません。`;
    },
  },
  {
    id: 'fuel-cost', name: 'ガソリン代の目安', category: 'お出かけ',
    description: '走る距離と車の燃費から、ドライブや通勤の燃料代を見積もります。',
    keywords: 'ドライブ 燃料 ガソリン 軽油 燃費 車 交通費 km リットル',
    fields: [
      number('distance', '走る距離の合計（km・往復なら往復分）'),
      number('efficiency', '車の燃費（km/L）', 0.001),
      number('price', '燃料1Lの価格（円）', 0.01),
    ],
    calculate({ distance, efficiency, price }) {
      if (distance === undefined || !efficiency || price === undefined) return '距離・燃費・1Lあたりの価格を入力してください。';
      const liters = distance / efficiency;
      const cost = liters * price;
      if (!Number.isFinite(cost)) return '計算範囲を超えています。';
      return `燃料代 約${format(Math.round(cost))}円（1円単位で四捨五入）\n使う燃料 約${format(liters)}L`;
    },
  },
];
