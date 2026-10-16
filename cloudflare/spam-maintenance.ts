import {expireSubmissions} from '../lib/protection/cleanup';
const maintenance = {
  async scheduled(_event:ScheduledController,env:{DB:D1Database;BUCKET:R2Bucket}){
    await expireSubmissions(env.DB,env.BUCKET);
    const now=Date.now();
    await env.DB.batch(['protection_counters','protection_tokens','protection_jobs','protection_events','mail_deliveries'].map(table=>env.DB.prepare(`DELETE FROM ${table} WHERE expires<?`).bind(now)));
  },
};

export default maintenance;
