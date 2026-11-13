# ちょっとしたツール

ブラウザ内で動く日付・単位・割合の計算ツール集。ビルドや外部ライブラリは不要です。

## ローカルで開く

```sh
python3 -m http.server 8000
```

ブラウザで http://localhost:8000/ を開きます。GitHub Pages では公開ソースのルートにある `index.html` を配信します。

## ツールを追加する

`js/calculators.js` の一覧に、ユニークな英小文字・ハイフンの `id`、`name`、`category`、`description`、`keywords`、`fields`、`calculate(values)` を持つ定義を追加します。検索結果、カテゴリ、個別の `#id` リンクに自動で反映されます。入力はブラウザ内で処理し、ツールの初期値・サンプル・Gitのコミット情報には公開可能な情報だけを使います。
