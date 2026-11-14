const MiB = 1024 * 1024;
const size = (bytes) => `${bytes.toLocaleString('ja-JP')} バイト`;

function requireFile(file, limit) {
  if (!file) throw new Error('ファイルを選択してください。');
  if (file.size > limit * MiB) throw new Error(`入力は ${limit} MiB 以内にしてください。`);
}

async function readStream(stream, limit) {
  const reader = stream.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return new Blob(chunks, { type: 'application/octet-stream' });
      bytes += value.byteLength;
      if (bytes > limit * MiB) {
        await reader.cancel();
        throw new RangeError(`出力が ${limit} MiB を超えたため中止しました。`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
}

export const fileTools = [
  {
    id: 'file-sha256', name: 'ファイルのSHA-256照合', category: 'ファイル',
    description: '配布元のチェックサムと照合。最大128 MiBのファイルを読み込めます。',
    keywords: 'sha256 checksum チェックサム ハッシュ ダイジェスト 一致 検証',
    fields: [
      { name: 'file', label: '対象ファイル', type: 'file' },
      { name: 'expected', label: '配布元のSHA-256（任意・16進64桁）', type: 'text' },
    ],
    async calculate({ file, expected }) {
      requireFile(file, 128);
      const reference = expected.trim().toLowerCase();
      if (reference && !/^[0-9a-f]{64}$/.test(reference)) {
        throw new Error('照合用のSHA-256は16進数64桁で入力してください。');
      }
      if (!globalThis.crypto?.subtle) throw new Error('SHA-256はHTTPSまたはlocalhostで利用できます。');
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
      const verdict = reference ? (reference === hash ? 'SHA-256は一致しました。' : 'SHA-256が一致しません。') : 'SHA-256を計算しました。';
      return { text: `${verdict}\n${size(file.size)}`, detail: hash };
    },
  },
  {
    id: 'gzip-file', name: 'Gzip圧縮・展開', category: 'ファイル',
    description: '最大128 MiBのファイルをGzip圧縮・展開して保存。出力は最大128 MiB。',
    keywords: 'gzip gz compress decompress 圧縮 解凍 展開 アーカイブ',
    fields: [
      { name: 'file', label: '対象ファイル', type: 'file' },
      { name: 'mode', label: '処理', choices: [['compress', 'Gzip圧縮'], ['decompress', 'Gzip展開']] },
    ],
    async calculate({ file, mode }) {
      requireFile(file, 128);
      const decompress = mode === 'decompress';
      const Codec = decompress ? globalThis.DecompressionStream : globalThis.CompressionStream;
      if (!Codec) throw new Error('このブラウザはGzip処理に対応していません。');
      let blob;
      try {
        blob = await readStream(file.stream().pipeThrough(new Codec('gzip')), 128);
      } catch (error) {
        if (error instanceof RangeError) throw error;
        throw new Error(decompress
          ? 'Gzipを展開できません。形式またはデータの破損を確認してください。'
          : 'ファイルを圧縮できませんでした。');
      }
      const filename = decompress ? (file.name.replace(/\.gz$/i, '') || '展開済みファイル') : file.name + '.gz';
      return { text: `${size(file.size)} → ${size(blob.size)}`, artifact: { filename, blob } };
    },
  },
];
