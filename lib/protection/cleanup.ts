// Shared by opportunistic request cleanup and the separately deployed scheduled maintenance Worker.
export async function removeStoredSubmission(db:D1Database,bucket:R2Bucket,id:string){
  const rows=await db.prepare('SELECT key FROM files WHERE submission_id=?').bind(id).all<{key:string}>();
  if(rows.results.length)await bucket.delete(rows.results.map(x=>x.key));
  await db.batch([db.prepare('DELETE FROM files WHERE submission_id=?').bind(id),db.prepare('DELETE FROM submissions WHERE id=?').bind(id)]);
}
export async function expireSubmissions(db:D1Database,bucket:R2Bucket,now=Date.now()){
  const rows=await db.prepare('SELECT id FROM submissions WHERE expires<? LIMIT 100').bind(now).all<{id:string}>();
  for(const row of rows.results)await removeStoredSubmission(db,bucket,row.id);
}
