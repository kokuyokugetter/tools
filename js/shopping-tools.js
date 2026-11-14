const number = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 4 });
const format = (value) => number.format(value);
const decimal = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

export const shoppingTools = [
  {
    id: 'price-per-gram', name: 'グラム単価のまとめ比較', category: '買い物',
    description: '容量の違う商品を最大1,000件を並べて、100gあたりの価格が安い順に比較。',
    keywords: 'g kg グラム 100g 単価 大容量 コスパ お得 食品 値段',
    fields: [{
      name: 'products', label: '1行に1商品「商品名,価格（円）,内容量（g）」',
      type: 'textarea', value: '商品A,298,400\n商品B,498,750\n商品C,168,180',
    }],
    calculate({ products }) {
      if (products.length > 250_000) throw new Error('入力は25万文字以内にしてください。');
      const rows = products.split(/\r\n?|\n/).map((line, index) => ({ line, index }))
        .filter(({ line }) => line.trim());
      if (!rows.length || rows.length > 1000) throw new Error('商品を1〜1,000件入力してください。');
      const ranked = rows.map(({ line, index }) => {
        const [name, yen, grams, extra] = line.replace(/，/g, ',').split(',').map((part) => part.trim());
        const price = Number(yen?.normalize('NFKC'));
        const weight = Number(grams?.normalize('NFKC'));
        const rate = price / weight * 100;
        if (!name || extra !== undefined || !decimal.test(yen?.normalize('NFKC')) ||
            !decimal.test(grams?.normalize('NFKC')) || !(weight > 0) || !Number.isFinite(rate)) {
          throw new Error(`${index + 1}行目は「商品名,価格（0円以上）,内容量（0gより大きい値）」で入力してください。`);
        }
        return { name, price, weight, rate };
      }).sort((a, b) => a.rate - b.rate);
      const detail = ranked.map(({ name, price, weight, rate }, index) =>
        `${index + 1}. ${name}　${format(rate)} 円 / 100g　（${format(price)}円 / ${format(weight)}g）`).join('\n');
      return { text: `最安単価 ${format(ranked[0].rate)} 円 / 100g（${ranked.length}件を比較）`, detail };
    },
  },
  {
    id: 'discount-rate', name: '実際の割引率を逆算', category: '買い物',
    description: '元値と現在価格から、何割引・何％引きかと値引き額を計算。',
    keywords: '価格 セール 値引き 割引き 割合 逆算 off パーセント',
    fields: [
      { name: 'original', label: '元の価格（円）', type: 'number', step: 'any', min: 0.01, value: 1980 },
      { name: 'current', label: '現在価格（円）', type: 'number', step: 'any', min: 0, value: 1480 },
    ],
    calculate({ original, current }) {
      if (!(original > 0) || !(current >= 0)) throw new Error('元の価格は0円より大きい値、現在価格は0円以上で入力してください。');
      const difference = original - current;
      const rate = Math.abs(difference) / original;
      if (!Number.isFinite(rate * 100)) throw new Error('計算範囲を超えています。');
      if (difference === 0) return { text: '価格は同じです（0%）。' };
      const change = difference > 0 ? '引き' : '増し';
      const label = difference > 0 ? '値引き額' : '値上がり額';
      return { text: `${format(rate * 100)}% ${change}（${format(rate * 10)}割${difference > 0 ? '引' : '増'}）\n${label} ${format(Math.abs(difference))}円` };
    },
  },
];
