export const env=new Proxy({}, {get(_target,key){return globalThis.__spamEnv?.[key];}});
