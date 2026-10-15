import { chromium, expect } from '@playwright/test';
import { generateKeyPairSync, createHash, sign } from 'node:crypto';
import { mkdtemp, readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const directory=await mkdtemp(path.join(os.tmpdir(),'qusu-auto-update-'));
const target=JSON.parse(await readFile('package.json','utf8')).version;
const arch=process.arch==='arm64'?'arm64':'x64';
const platform=`${process.platform==='win32'?'win':'mac'}-${arch}`;
const name=`QUSU-Editor-${target}-update-${platform}.zip`;
const payload=await readFile(path.join('release',name));
const fragment=JSON.parse(await readFile(path.join('release',`update-${platform}.json`),'utf8'));
const keys=generateKeyPairSync('ed25519');
const publicKey=keys.publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64');
const manifest=Buffer.from(JSON.stringify({version:target,assets:{[platform]:fragment.asset}}));
const signature=sign(null,manifest,keys.privateKey).toString('base64');
const originalVersion='1.3.99';
let mode='current';let payloadRequests=0;
const feed=http.createServer((request,response)=>{
  if(request.url==='/latest'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({tag_name:`v${mode==='current'?originalVersion:target}`}));}
  else if(request.url.endsWith('/update-manifest.json'))response.end(manifest);
  else if(request.url.endsWith('/update-manifest.sig'))response.end(mode==='bad-signature'?'invalid':signature);
  else if(request.url.endsWith('/'+name)){payloadRequests++;if(mode==='bad-hash'){const corrupt=Buffer.from(payload);corrupt[corrupt.length-1]^=1;response.end(corrupt);}else response.end(payload);}
  else{response.writeHead(404);response.end();}
});
await new Promise(resolve=>feed.listen(0,'127.0.0.1',resolve));
const feedURL=`http://127.0.0.1:${feed.address().port}/latest`;
const bootstrap=process.platform==='win32'?path.join(directory,'bootstrap.exe'):path.join(directory,'Bootstrap.app','Contents','MacOS','QUSU Editor');
if(process.platform==='darwin')await cp(path.resolve(`release/mac-${arch}/QUSU Editor.app`),path.join(directory,'Bootstrap.app'),{recursive:true});
await mkdir(path.dirname(bootstrap),{recursive:true});
function run(command,args,options={}){const result=spawnSync(command,args,{stdio:'inherit',...options});if(result.error)throw result.error;if(result.status!==0)throw new Error(`${command} failed: ${result.status}`);}
run(process.env.QUSU_GO||'go',['build','-trimpath','-ldflags',`-s -w -X main.version=${originalVersion} -X main.updatePublicKey=${publicKey}${process.platform==='win32'?' -H=windowsgui':''}`,'-o',bootstrap,'.'],{cwd:path.resolve('launcher')});
if(process.platform==='darwin')run('/usr/bin/codesign',['--force','--deep','--sign','-',path.join(directory,'Bootstrap.app')]);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));return port;}
async function scenario(rollback){
  mode='current';
  const userData=path.join(directory,rollback?'rollback':'success');await mkdir(userData,{recursive:true});
  const port=await freePort();const url=`http://127.0.0.1:${port}/`;
  const env={...process.env,QUSU_TEST_USER_DATA:userData,QUSU_TEST_PORT:String(port),QUSU_TEST_UPDATE_FEED:feedURL,...(rollback?{QUSU_TEST_UPDATE_FAIL_VERSION:target}:{})};
  const launch=()=>spawn(bootstrap,[],{env,stdio:['pipe','ignore','pipe'],windowsHide:true});
  const status=async()=>fetch(url+'.qusu-update').then(r=>r.json()).catch(()=>({}));
  const health=async()=>fetch(url+'.qusu-launcher').then(r=>r.json()).catch(()=>({}));
  async function stopOwned(){
    const info=await health();if(info.id!=='com.qusu.editor')return;
    const lines=(await readFile(path.join(userData,'native-instances.jsonl'),'utf8')).trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));const current=lines.at(-1);
    if(!current||current.version!==info.version)throw new Error('Refusing to stop a process outside this updater test.');
    try{process.kill(current.pid);}catch(error){if(error.code!=='ESRCH')throw error;}
    await expect.poll(async()=>(await health()).id,{timeout:10000}).not.toBe('com.qusu.editor');
  }
  let browser;const initial=launch();initial.stderr.on('data',data=>process.stderr.write(data));
  try{
    await expect.poll(async()=>(await health()).version,{timeout:15000}).toBe(originalVersion);
    browser=await chromium.launchPersistentContext(path.join(userData,'browser'),{headless:true});
    const page=await browser.newPage();await page.goto(url);
    await expect(page.getByRole('button',{name:'检查更新',exact:true})).toBeVisible();
    await page.getByLabel('当前文章名称').fill('自动升级保留的文章');
    await page.getByLabel('文章主标题',{exact:true}).fill(rollback?'回退后仍在的内容':'文章内容保持独立');
    await page.locator('[data-block-type=image] input[type=file]').setInputFiles({name:'keep.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6kAAAAABJRU5ErkJggg==','base64')});
    await expect(page.locator('[data-block-type=image] img')).toHaveAttribute('src',/^data:image/);
    await expect(page.getByText('已自动保存',{exact:true})).toBeVisible();
    const articlePage=rollback?null:await browser.newPage();
    if(articlePage){
      await articlePage.goto(url);await expect(articlePage.getByLabel('当前文章名称')).toHaveValue('自动升级保留的文章');
      await page.getByRole('tab',{name:'模板',exact:true}).click();
      await page.getByLabel('模板名称',{exact:true}).fill('升级时保留的模板草稿');
      await page.getByRole('button',{name:'进入模板编辑',exact:true}).click();
      await expect(page.getByLabel('当前模板名称')).toHaveValue('升级时保留的模板草稿');
      await page.getByLabel('文章主标题',{exact:true}).fill('这份模板尚未确认保存');
      await articlePage.evaluate(()=>{
        const transaction=IDBDatabase.prototype.transaction,setItem=Storage.prototype.setItem;
        IDBDatabase.prototype.transaction=()=>{throw new Error('Simulated unavailable IndexedDB');};
        Storage.prototype.setItem=function(key,value){if(key==='qusu-editor-workspace-v1')throw new Error('Simulated quota exceeded');return setItem.call(this,key,value);};
        window.restoreUpdateStorage=()=>{IDBDatabase.prototype.transaction=transaction;Storage.prototype.setItem=setItem;};
      });
      await articlePage.getByLabel('文章主标题',{exact:true}).fill('另一窗口的文章也必须保存');
      for(const bad of ['bad-signature','bad-hash']){
        mode=bad;await page.getByRole('button',{name:'检查更新',exact:true}).click();
        await expect.poll(async()=>(await status()).phase,{timeout:15000}).toBe('error');
        expect((await status()).error).toContain(bad==='bad-signature'?'签名':'校验');
        expect((await health()).version).toBe(originalVersion);
      }
    }
    mode='valid';await page.getByRole('button',{name:'检查更新',exact:true}).click();
    if(articlePage){
      await expect(articlePage.getByLabel('软件自动更新')).toContainText('当前内容保存失败，已暂停自动升级',{timeout:20000});
      await sleep(11000);expect((await health()).version).toBe(originalVersion);
      await page.screenshot({path:'test-results/auto-update-saving.png'});
      await articlePage.evaluate(()=>window.restoreUpdateStorage());
      await articlePage.getByLabel('软件自动更新').getByRole('button',{name:'重试',exact:true}).click();
    }
    if(rollback){
      await expect.poll(async()=>(await status()).error||'',{timeout:60000}).toContain('新版启动失败');
      const before=payloadRequests;
      expect((await health()).version).toBe(originalVersion);
      await expect(page.getByLabel('文章主标题',{exact:true})).toHaveValue('回退后仍在的内容');
      await expect(page.locator('.app-shell')).not.toHaveAttribute('inert','');
      await sleep(5000);expect(payloadRequests).toBe(before);
      console.log('Updater rollback passed: failed new startup restores the prior version and preserves the loaded article without an automatic retry loop.');
    }else{
      await expect.poll(async()=>(await health()).version,{timeout:45000}).toBe(target);
      await expect(page.getByLabel('当前模板名称')).toHaveValue('升级时保留的模板草稿',{timeout:20000});
      await expect(page.getByLabel('文章主标题',{exact:true})).toHaveValue('这份模板尚未确认保存');
      await expect(page.getByText('模板修改未保存',{exact:true})).toBeVisible();
      await expect(articlePage.getByLabel('当前文章名称')).toHaveValue('自动升级保留的文章');
      await expect(articlePage.getByLabel('文章主标题',{exact:true})).toHaveValue('另一窗口的文章也必须保存');
      await expect(articlePage.locator('[data-block-type=image] img')).toHaveAttribute('src',/^data:image/);
      await stopOwned();const cold=launch();cold.stderr.on('data',data=>process.stderr.write(data));
      await expect.poll(async()=>(await health()).version,{timeout:15000}).toBe(target);
      console.log('Automatic upgrade passed: signature and hash rejection, multi-tab save failure protection, independent template draft, article, local image, automatic reload and cold launch through the original shortcut.');
    }
  }finally{if(browser)await browser.close();await stopOwned();if(initial.exitCode===null)initial.kill();}
}
try{await scenario(false);await scenario(true);}finally{await new Promise(resolve=>feed.close(resolve));}
