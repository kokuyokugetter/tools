const format = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 4 }).format;
const input = (name, label, min) => ({ name, label, min, type: 'number', step: 'any' });

const units = [
  ['g', 'g', 1, '100g', 100], ['kg', 'kg', 1000, '100g', 100],
  ['ml', 'mL', 1, '100mL', 100], ['l', 'L', 1000, '100mL', 100],
  ['each', '個・枚', 1, '1点', 1],
];

export const shoppingTools = [
  {
    id: 'price-per-gram', name: 'どっちがお得？ 単価比較', category: '買い物',
    description: '価格と内容量を入れるだけ。3商品以上も比べられます。',
    keywords: 'g kg グラム 100g ml 単価 大容量 コスパ お得 食品 値段 ねだん 容量',
    mount(form, result, controlFor) {
      const products = [];
      let nextId = 1;
      const hint = document.createElement('p');
      hint.className = 'field-wide form-hint';
      hint.textContent = '価格の条件をそろえ（例：すべて税込）、複数個入りは合計の内容量を入力してください。';
      const list = document.createElement('div');
      list.className = 'field-wide product-list';
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'add-product';
      add.textContent = '＋ 商品を追加';
      form.append(hint, list, add);

      function update() {
        const groups = new Map();
        let incomplete = 0;
        for (const { id, name, price, amount, unit } of products) {
          if (!price.value && !amount.value && !price.validity.badInput && !amount.validity.badInput) continue;
          const [, , factor, base, scale] = units.find(([value]) => value === unit.value);
          const rate = price.valueAsNumber / (amount.valueAsNumber * factor) * scale;
          if (!price.validity.valid || !(amount.valueAsNumber > 0) || !Number.isFinite(rate)) {
            incomplete++;
            continue;
          }
          if (!groups.has(base)) groups.set(base, []);
          groups.get(base).push({ label: name.value.trim() || '商品' + id, rate });
        }
        const lines = [];
        for (const [base, items] of groups) {
          items.sort((a, b) => a.rate - b.rate);
          const { rate } = items[0];
          const same = items.filter((item) => Math.abs(item.rate - rate) <= Number.EPSILON * Math.max(item.rate, rate) * 4);
          if (same.length > 1) {
            lines.push(`${same.map(({ label }) => label).join('・')}が同じ最安単価（${base}あたり）`);
          } else if (items.length > 1) {
            lines.push(`${items[0].label}がお得（${base}あたり2番目より${format(items[1].rate - rate)}円安い）`);
          }
          lines.push(...items.map(({ label, rate: value }) => `${label}　${format(value)}円 / ${base}`));
        }
        if (groups.size > 1) lines.push('重さ・容量・個数は、同じ種類ごとに比較します。');
        if (incomplete) lines.push(`${incomplete}件の価格と内容量を確認してください。`);
        result.textContent = lines.join('\n') || '商品の価格と内容量を入力してください。';
        for (const { remove } of products) remove.disabled = products.length <= 2;
      }

      function addProduct(focus = false) {
        const id = nextId++;
        const row = document.createElement('fieldset');
        const title = document.createElement('legend');
        title.textContent = '商品' + id;
        const priceLabel = controlFor(input('price', '価格（円）', 0));
        const amountLabel = controlFor(input('amount', '内容量', 0));
        const unitLabel = controlFor({ name: 'unit', label: '単位', choices: units });
        const nameLabel = controlFor({ name: 'productName', label: '商品名（任意）', type: 'text' });
        nameLabel.classList.add('product-name');
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '削除';
        remove.setAttribute('aria-label', '商品' + id + 'を削除');
        const price = priceLabel.querySelector('input');
        const amount = amountLabel.querySelector('input');
        const unit = unitLabel.querySelector('select');
        const product = { id, name: nameLabel.querySelector('input'), price, amount, unit, remove };
        remove.addEventListener('click', () => {
          products.splice(products.indexOf(product), 1);
          row.remove();
          update();
          add.focus();
        });
        row.append(title, priceLabel, amountLabel, unitLabel, nameLabel, remove);
        list.append(row);
        products.push(product);
        update();
        if (focus) price.focus();
      }

      add.addEventListener('click', () => addProduct(true));
      form.addEventListener('input', update);
      addProduct();
      addProduct();
    },
  },
  {
    id: 'discount-rate', name: '何割引？', category: '買い物',
    description: '元の値段と今の値段から、何割・何パーセント安くなったかを計算。',
    keywords: '割引率 割引 わりびき 価格 ねだん セール 値引き 逆算 off',
    fields: [input('original', '元の値段（円）', 0), input('current', '今の値段（円）', 0)],
    calculate({ original, current }) {
      if (!(original > 0) || !(current >= 0)) return '元の値段は0円より大きい値、今の値段は0円以上を入力してください。';
      const difference = original - current;
      const rate = Math.abs(difference) / original;
      if (!Number.isFinite(rate * 100)) return '計算範囲を超えています。';
      if (difference === 0) return '価格は同じです（0%）。';
      return difference > 0
        ? `${format(rate * 100)}%引き（${format(rate * 10)}割引）\n${format(difference)}円安くなります。`
        : `${format(rate * 100)}%値上がり\n${format(-difference)}円高くなります。`;
    },
  },
  {
    id: 'sales-tax', name: '税込・税抜はいくら？', category: '買い物',
    description: '税抜表示での支払額や、税込表示から税抜の目安を確認。',
    keywords: '消費税 税込み 税抜き ぜいこみ 8% 10% 本体価格 会計',
    fields: [
      { ...input('amount', '表示価格（円）', 0), step: 1, max: 1_000_000_000 },
      { name: 'direction', label: '表示価格は？', choices: [['before', '税抜'], ['after', '税込']] },
      { name: 'rate', label: '税率', choices: [['10', '10%'], ['8', '8%']] },
    ],
    calculate({ amount, direction, rate }) {
      if (amount === undefined) return '表示価格を0〜10億円の整数で入力してください。';
      const percent = Number(rate);
      if (direction === 'after') {
        const before = Math.round(amount * 100 / (100 + percent));
        return `税抜の目安 約${format(before)}円\n消費税相当額 約${format(amount - before)}円\n税込価格からの逆算は1円単位で四捨五入しています。`;
      }
      const tax = Math.floor(amount * percent / 100);
      return `税込の目安 ${format(amount + tax)}円\n消費税 ${format(tax)}円\n税額の1円未満は切り捨て。お店の端数処理で変わる場合があります。`;
    },
  },
];
