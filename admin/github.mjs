import { EDITABLE_PATHS } from '../assets/js/content-model.mjs';
export class GitHub {
  constructor(token, fetcher = fetch) { this.token = token; this.fetcher = fetcher; }
  async request(path, method = 'GET', body) {
    const response = await this.fetcher('https://api.github.com/repos/moliyingjiang/moliyingjiang.github.io/' + path, { method, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + this.token, 'X-GitHub-Api-Version': '2026-03-10' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error('GitHub 请求失败（' + response.status + '）。请检查令牌权限或网络；草稿仍保留。');
    return response.json();
  }
  async snapshot() {
    const ref = await this.request('git/ref/heads/main');
    const head = ref.object.sha, commit = await this.request('git/commits/' + head);
    const files = Object.fromEntries(await Promise.all(EDITABLE_PATHS.map(async path => {
      const file = await this.request('contents/' + path + '?ref=' + head);
      if (file.encoding !== 'base64') throw new Error('文件过大或格式不支持：' + path);
      return [path, new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0)))];
    })));
    return { head, tree: commit.tree.sha, files };
  }
  async publish(snapshot, files) {
    if (Object.keys(files).some(path => !EDITABLE_PATHS.includes(path))) throw new Error('禁止发布非内容文件。');
    const tree = Object.entries(files).filter(([path, content]) => content !== snapshot.files[path]).map(([path, content]) => ({ path, mode: '100644', type: 'blob', content }));
    if (!tree.length) return snapshot.head;
    const ref = await this.request('git/ref/heads/main');
    if (ref.object.sha !== snapshot.head) throw new Error('GitHub 已有新版本，请先导出草稿，再重新连接并合并修改。未覆盖线上内容。');
    const nextTree = await this.request('git/trees', 'POST', { base_tree: snapshot.tree, tree });
    const commit = await this.request('git/commits', 'POST', { message: 'Update academic portfolio via web editor', tree: nextTree.sha, parents: [snapshot.head] });
    await this.request('git/refs/heads/main', 'PATCH', { sha: commit.sha, force: false });
    snapshot.head = commit.sha; snapshot.tree = nextTree.sha; snapshot.files = { ...snapshot.files, ...files };
    return commit.sha;
  }
}
