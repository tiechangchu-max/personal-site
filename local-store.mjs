import { validateBatch, validateIndex } from './media-store.mjs';

export class LocalMediaStore {
  disconnect() {}
  async connect() {
    const response = await fetch('/api/status', { cache: 'no-store', credentials: 'same-origin' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '本机上传暂时不可用，请重新打开启动文件。');
    return validateIndex(data);
  }
  async publish(items, onProgress = () => {}) {
    validateBatch(items);
    const prepared = await fetch('/api/prepare', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-Portfolio-Request':'1'}, body:JSON.stringify({sources:items.map(item=>item.work.src)}) });
    if (!prepared.ok) throw new Error((await prepared.json()).error || '无法准备上传，请重试。');
    const total = items.reduce((sum, item) => sum + item.file.size, 0); let loaded = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open('PUT', `/api/files/${item.work.src.split('/').pop()}`);
        request.setRequestHeader('X-Portfolio-Request','1'); request.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
        request.timeout = 180000;
        request.upload.onprogress = event => onProgress(Math.round((loaded + event.loaded) / total * 75), `正在准备 ${i + 1}/${items.length}：${item.work.title}`);
        request.onload = () => { try { const data = JSON.parse(request.responseText); if (request.status >= 200 && request.status < 300) resolve(data); else reject(new Error(data.error || '文件上传失败，请重试。')); } catch { reject(new Error('本机上传服务返回异常，请重新打开启动文件。')); } };
        request.onerror = request.ontimeout = () => reject(new Error('本机上传连接中断，请重新打开「打开作品上传」后再试。'));
        request.send(item.file);
      });
      loaded += item.file.size;
    }
    onProgress(80, '正在发布到网站，请稍候…');
    const response = await fetch('/api/publish', { method: 'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-Portfolio-Request':'1'}, body:JSON.stringify({works:items.map(item=>item.work)}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '发布失败，请重试。');
    onProgress(100, '作品已保存。');
    return data;
  }
}
