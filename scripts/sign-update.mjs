import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const directory=path.resolve(process.argv[2]||'installers');
const version=JSON.parse(await readFile('package.json','utf8')).version;
if(process.env.RELEASE_TAG!==`v${version}`)throw new Error('Release tag must match the signed manifest version.');
const key=createPrivateKey(process.env.QUSU_UPDATE_SIGNING_KEY||'');
const publicKey=createPublicKey(key);
const expected=(await readFile('launcher/updater.go','utf8')).match(/var updatePublicKey = "([^"]+)"/)?.[1];
if(publicKey.export({type:'spki',format:'der'}).subarray(-32).toString('base64')!==expected)throw new Error('Signing key does not match the verification key shipped with the app.');
const manifest={schema:1,version,assets:{}};
for(const platform of ['win-x64','win-arm64','mac-x64','mac-arm64']){
  const fragment=JSON.parse(await readFile(path.join(directory,`update-${platform}.json`),'utf8'));
  if(fragment.version!==version||fragment.platform!==platform||fragment.asset.name!==`QUSU-Editor-${version}-update-${platform}.zip`)throw new Error('Update asset metadata mismatch.');
  const bytes=await readFile(path.join(directory,fragment.asset.name));
  if(bytes.length!==fragment.asset.size||createHash('sha256').update(bytes).digest('hex')!==fragment.asset.sha256)throw new Error('Update package hash mismatch.');
  manifest.assets[platform]=fragment.asset;
}
const bytes=Buffer.from(JSON.stringify(manifest));
const signature=sign(null,bytes,key);
if(!verify(null,bytes,publicKey,signature))throw new Error('Signature self verification failed.');
await writeFile(path.join(directory,'update-manifest.json'),bytes);
await writeFile(path.join(directory,'update-manifest.sig'),signature.toString('base64'));
console.log(`Signed and verified update manifest for v${version} (${Object.keys(manifest.assets).length} architectures).`);
