import {sqliteTable,text,integer,index,primaryKey,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const submissions=sqliteTable('submissions',{id:text('id').primaryKey(),kind:text('kind').notNull(),name:text('name').notNull(),email:text('email').notNull(),details:text('details').notNull(),created:integer('created').notNull(),expires:integer('expires').notNull(),rateKey:text('rate_key').notNull()},t=>[index('submission_created').on(t.created),index('submission_rate').on(t.rateKey,t.created)]);
export const files=sqliteTable('files',{id:text('id').primaryKey(),submissionId:text('submission_id').notNull().references(()=>submissions.id),name:text('name').notNull(),size:integer('size').notNull(),key:text('key').notNull(),scanStatus:text('scan_status').notNull().default('unscanned'),contentSha256:text('content_sha256')});

export const protectionCounters=sqliteTable('protection_counters',{
 scope:text('scope').notNull(),subject:text('subject').notNull(),window:integer('window').notNull(),hits:integer('hits').notNull(),expires:integer('expires').notNull(),
},t=>[primaryKey({columns:[t.scope,t.subject,t.window]}),index('protection_counter_expiry').on(t.expires)]);
export const protectionTokens=sqliteTable('protection_tokens',{digest:text('digest').primaryKey(),expires:integer('expires').notNull()},t=>[index('protection_token_expiry').on(t.expires)]);
export const protectionJobs=sqliteTable('protection_jobs',{
 id:text('id').primaryKey(),form:text('form').notNull(),digest:text('digest').notNull(),state:text('state').notNull(),result:text('result'),created:integer('created').notNull(),expires:integer('expires').notNull(),
},t=>[uniqueIndex('protection_job_digest').on(t.form,t.digest),index('protection_job_expiry').on(t.expires)]);
export const protectionEvents=sqliteTable('protection_events',{
 id:text('id').primaryKey(),form:text('form').notNull(),code:text('code').notNull(),created:integer('created').notNull(),expires:integer('expires').notNull(),
},t=>[index('protection_event_expiry').on(t.expires)]);
export const mailDeliveries=sqliteTable('mail_deliveries',{
 jobId:text('job_id').notNull(),audience:text('audience').notNull(),state:text('state').notNull(),providerId:text('provider_id'),updated:integer('updated').notNull(),expires:integer('expires').notNull(),
},t=>[primaryKey({columns:[t.jobId,t.audience]}),index('mail_delivery_expiry').on(t.expires)]);
