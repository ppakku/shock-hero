import { createSaveStore, browserStorage } from './logic/save.js';

export const saveStore = createSaveStore(browserStorage());
