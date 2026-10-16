// Test-only transform; no additional runtime dependencies or production aliases.
import ts from '../node_modules/typescript/lib/typescript.js';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
export async function resolve(specifier,context,next){
  if(specifier==='cloudflare:workers')return {url:new URL('./worker-bindings.mjs',import.meta.url).href,shortCircuit:true};
  let base;
  if(specifier.startsWith('@/'))base=path.join(root,specifier.slice(2));
  else if(specifier.startsWith('.')&&context.parentURL?.startsWith('file:'))base=fileURLToPath(new URL(specifier,context.parentURL));
  if(base){for(const suffix of ['', '.ts','.tsx']){try{await access(base+suffix);if(/\.tsx?$/.test(base+suffix))return {url:pathToFileURL(base+suffix).href,shortCircuit:true};}catch{}}}
  return next(specifier,context);
}
export async function load(url,context,next){
  if(/\.tsx?$/.test(url))return {format:'module',shortCircuit:true,source:ts.transpileModule(await readFile(new URL(url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText};
  return next(url,context);
}
