import { shoppingTools } from './shopping-tools.js';
import { dataTools } from './data-tools.js';
import { fileTools } from './file-tools.js';
import { planningTools } from './planning-tools.js';
import { statisticsTools } from './statistics-tools.js';

export const advancedTools = [
  ...shoppingTools,
  ...dataTools,
  ...planningTools,
  ...statisticsTools,
  ...fileTools,
];
