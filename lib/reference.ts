/** Public reference, never an authorization token. UUIDs already stored remain valid. */
export function newReference(prefix='OD') {
  const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes=crypto.getRandomValues(new Uint8Array(10));
  // Rejection sampling prevents modulo bias.
  const chars=[];
  for(let i=0;i<10;i++){
    let b=bytes[i];
    while(b>=Math.floor(256/alphabet.length)*alphabet.length)b=crypto.getRandomValues(new Uint8Array(1))[0];
    chars.push(alphabet[b%alphabet.length]);
  }
  return `${prefix}-${String(new Date().getUTCFullYear()).slice(-2)}-${chars.join('')}`;
}
