import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import {POST} from '../app/api/generate/route';
import {GET} from '../app/api/health/route';
test('health reports actual runtime mode',async()=>{const r=GET();assert.equal(r.status,200);assert.equal((await r.json()).status,'ok');});
test('generation rejects invalid schema before contacting a provider',async()=>{const r=await POST(new NextRequest('http://localhost/api/generate',{method:'POST',body:JSON.stringify({kind:'invalid'})}));assert.equal(r.status,400);});
test('generation rejects oversized body and malformed JSON',async()=>{const big=await POST(new NextRequest('http://localhost/api/generate',{method:'POST',body:'x'.repeat(21000)}));assert.equal(big.status,413);const bad=await POST(new NextRequest('http://localhost/api/generate',{method:'POST',body:'{'}));assert.equal(bad.status,400);});
test('unconfigured generation is explicitly labeled demo',async()=>{if(process.env.OPENAI_API_KEY||process.env.NEXT_PUBLIC_SUPABASE_URL)return;const r=await POST(new NextRequest('http://localhost/api/generate',{method:'POST',body:JSON.stringify({kind:'campaign',product:'Test watch',audience:'Loyal customers'})}));assert.equal(r.status,200);const d=await r.json();assert.equal(d.mode,'demo');assert.match(d.content,/Test watch/);assert.match(d.content,/not AI generated/);});
