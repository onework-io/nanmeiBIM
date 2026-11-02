'use strict';
const $ = id => document.getElementById(id);
let viewer, models = [], active, busy = false, generation = 0;
let ghostMode = false, modelReady = false;
function controls(enabled) {
  modelReady = enabled;
  ['fit', 'reset', 'search-button', 'restore', 'mode-hide', 'mode-ghost'].forEach(id => $(id).disabled = !enabled);
  $('isolate').disabled = !enabled || !viewer?.getSelection().length;
  document.querySelectorAll('.model').forEach(button => button.disabled = busy);
}
function fail(message) {
  busy = false;
  $('loading').hidden = false;
  $('loading').classList.add('error');
  $('loading-title').textContent = '無法載入模型';
  $('loading-detail').textContent = message;
  $('retry').hidden = false;
  $('status').textContent = '載入失敗';
  controls(false);
}
function renderModels() {
  $('count').textContent = models.length;
  $('models').replaceChildren();
  models.forEach(model => {
    const button = document.createElement('button');
    button.className = 'model';
    button.dataset.url = model.url;
    button.innerHTML = '<span class="icon" aria-hidden="true">◈</span><span><strong></strong><small></small></span><span class="arrow" aria-hidden="true">›</span>';
    button.querySelector('strong').textContent = model.name;
    button.querySelector('small').textContent = `SVF · ${(model.size / 1048576).toFixed(1)} MB`;
    button.onclick = () => load(model);
    $('models').append(button);
  });
}
function load(model) {
  if (busy) return;
  active = model;
  generation++;
  busy = true;
  controls(false);
  $('loading').classList.remove('error');
  $('loading').hidden = false;
  $('retry').hidden = true;
  $('loading-title').textContent = `正在開啟 ${model.name}`;
  $('loading-detail').textContent = '載入幾何、材質與構件屬性…';
  $('status').textContent = '讀取模型資源';
  $('model-title').textContent = model.name;
  $('search').value = '';
  $('isolation-status').textContent = '選取元件後可隔離顯示';
  $('search-status').textContent = '選取構件即可查看屬性';
  document.querySelectorAll('.model').forEach(button => {
    const selected = button.dataset.url === model.url;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-current', selected ? 'true' : 'false');
  });
  if (viewer.model) viewer.unloadModel(viewer.model);
  viewer.loadModel(new URL(model.url, document.baseURI).href, {}, () => {}, (code, message) => fail(`模型資源讀取失敗（${code}）。${message || '請確認 SVF 壓縮包包含完整相依檔案。'}`));
}
async function start() {
  try {
    const response = await fetch('./models.json');
    if (!response.ok) throw new Error('無法取得模型清單，請確認網站已完整部署。');
    models = await response.json();
    renderModels();
    if (!models.length) throw new Error('BIM 資料夾中沒有可讀取的 .svfzip 模型。請加入包含 .svf 的完整模型包後重新整理。');
    if (!window.Autodesk) throw new Error('Viewer 套件未載入，請檢查 forge-viewer 資料夾。');
    Autodesk.Viewing.Initializer({env: 'Local', offline: 'true', useADP: false, optOutTrackingByDefault: true, language: 'zh-HANT'}, () => {
      try {
        viewer = new Autodesk.Viewing.GuiViewer3D($('viewer'));
        const code = viewer.start();
        if (code) throw new Error(`Viewer 初始化失敗（${code}），請確認瀏覽器已開啟 WebGL 與硬體加速。`);
        viewer.setTheme('light-theme');
        viewer.setBackgroundColor(238, 243, 246, 224, 233, 238);
        viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
          busy = false;
          $('loading').hidden = true;
          $('status').textContent = '● 模型已載入 · 本站資源';
          viewer.setGhosting(ghostMode);
          controls(true);
          viewer.fitToView();
          const modelStructure = viewer.getExtension('Autodesk.ModelStructure');
          if (modelStructure) modelStructure.activate();
        });
        viewer.addEventListener(Autodesk.Viewing.ISOLATE_EVENT, event => {
          $('isolation-status').textContent = event.nodeIdArray?.length ? `隔離中 · 其他元件${ghostMode ? '半透明' : '完全隱藏'}` : '顯示全部元件';
        });
        viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, event => {
          $('isolate').disabled = !modelReady || !event.dbIdArray.length;
          $('search-status').textContent = event.dbIdArray.length ? `已選取 ${event.dbIdArray.length} 個構件 · 可使用下方工具列查看屬性` : '選取構件即可查看屬性';
        });
        new ResizeObserver(() => viewer.resize()).observe($('viewer'));
        load(models[0]);
      } catch (error) { fail(error.message); }
    });
  } catch (error) { fail(error.message); }
}
function setIsolationMode(ghost) {
  ghostMode = ghost;
  viewer.setGhosting(ghost);
  $('mode-hide').setAttribute('aria-pressed', String(!ghost));
  $('mode-ghost').setAttribute('aria-pressed', String(ghost));
  $('isolation-status').textContent = `其他元件：${ghost ? '半透明' : '完全隱藏'} · 隔離時套用`;
}
$('mode-hide').onclick = () => setIsolationMode(false);
$('mode-ghost').onclick = () => setIsolationMode(true);
$('isolate').onclick = () => {
  const ids = viewer.getSelection();
  if (!ids.length) return;
  generation++;
  viewer.setGhosting(ghostMode);
  viewer.isolate(ids);
  viewer.fitToView(ids);
};
$('restore').onclick = () => {
  generation++;
  viewer.showAll();
  viewer.clearSelection();
  viewer.fitToView();
  $('search').value = '';
  $('isolation-status').textContent = '已還原全部元件';
};
$('fit').onclick = () => viewer.fitToView();
$('reset').onclick = () => {
  generation++;
  viewer.showAll();
  viewer.clearSelection();
  viewer.explode(0);
  const section = viewer.getExtension('Autodesk.Section');
  if (section) section.deactivate();
  viewer.fitToView();
  $('search').value = '';
  $('search-status').textContent = '已重設顯示';
};
$('retry').onclick = () => location.reload();
$('search-form').onsubmit = event => {
  event.preventDefault();
  if (!viewer || !viewer.model || busy) return;
  const query = $('search').value.trim();
  const token = ++generation;
  viewer.showAll();
  viewer.clearSelection();
  if (!query) { viewer.fitToView(); return; }
  $('search-status').textContent = '搜尋中…';
  viewer.search(query, ids => {
    if (token !== generation) return;
    if (ids.length) { viewer.isolate(ids); viewer.select(ids); viewer.fitToView(ids); }
    $('search-status').textContent = ids.length ? `找到 ${ids.length} 個構件` : '找不到符合的構件，請嘗試其他關鍵字';
  }, () => {
    if (token === generation) $('search-status').textContent = '構件屬性尚未就緒或讀取失敗，請稍後再試';
  }, ['name']);
};
start();
