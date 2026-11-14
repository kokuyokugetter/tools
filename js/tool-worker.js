import { advancedTools } from './advanced-tools.js';

const tools = new Map(advancedTools.map((tool) => [tool.id, tool]));

self.onmessage = async ({ data: { id, values } }) => {
  try {
    const result = await tools.get(id).calculate(values);
    self.postMessage(result);
  } catch (error) {
    self.postMessage({ text: error instanceof Error ? error.message : '計算に失敗しました。' });
  }
};
