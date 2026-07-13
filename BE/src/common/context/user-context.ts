import { AsyncLocalStorage } from 'async_hooks';

export const userContext = new AsyncLocalStorage<{ userId: string }>();
