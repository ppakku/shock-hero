import { createSaveStore, browserStorage } from './logic/save.js';
import { gemsFromProgress } from './logic/rewards.js';
import { stages } from './stage/index.js';
import { cfg } from './config/index.js';

export const saveStore = createSaveStore(browserStorage(), { gemsFor: (save) => gemsFromProgress(save, stages, cfg.gems) });
