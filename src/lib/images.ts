export const imageAccept = 'image/png,image/jpeg,image/gif,image/webp';
export async function readImage(file:File):Promise<string>{
  if(!['image/png','image/jpeg','image/gif','image/webp'].includes(file.type))throw new Error('支持 PNG、JPEG、GIF 和 WebP 图片。');
  if(file.size>3*1024*1024)throw new Error('单张图片请小于 3MB，以便可靠自动保存。');
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(file);});
}
