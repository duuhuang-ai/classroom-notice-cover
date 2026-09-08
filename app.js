import { SCENES } from "./data/scenes.js";
import {
  buildSceneSequence,
  getNoticeWarning,
  parseNoticeDocument,
  sanitizeFilename,
} from "./logic.mjs";

const MAX_NOTICES = 20;
const PREVIEW_WIDTH = 360;
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1440;

const EXAMPLES = `## 通知1
18号同学
请于课间到办公室
携带上周的请假条

## 通知2
今天下午第二节
语文课调整为班会课
请提前准备班会材料

## 通知3
明天第三节进行体育测试
请穿运动鞋
提前做好热身准备

## 通知4
今天第三组留下
负责地面、黑板和讲台
完成后关好门窗

## 通知5
各科课代表
请于大课间到年级办公室
领取本周练习资料

## 通知6
各组组长课后留下
整理桌椅和班级展示区
完成后到办公室登记

## 通知7
请提前准备准考证和文具
手机按要求统一存放
开考前20分钟进入教室

## 通知8
请穿好实验服
未经允许不得操作设备
有问题立即报告老师

## 通知9
请同学们保持安静
提前准备下午课本
13:50前回到座位

## 通知10
请全体班主任
今天下午5:10到会议室
参加学期安全工作会议`;

const elements = {
  input: document.querySelector("#notice-input"),
  count: document.querySelector("#notice-count"),
  inputMessage: document.querySelector("#input-message"),
  parseModes: [...document.querySelectorAll('input[name="parse-mode"]')],
  reparseButton: document.querySelector("#reparse-button"),
  addDraftButton: document.querySelector("#add-draft-button"),
  draftEmpty: document.querySelector("#draft-empty"),
  draftList: document.querySelector("#draft-list"),
  exampleButton: document.querySelector("#example-button"),
  generateButton: document.querySelector("#generate-button"),
  sceneReel: document.querySelector("#scene-reel"),
  emptyState: document.querySelector("#empty-state"),
  resultsGrid: document.querySelector("#results-grid"),
  resultSummary: document.querySelector("#result-summary"),
  reshuffleButton: document.querySelector("#reshuffle-button"),
  downloadAllButton: document.querySelector("#download-all-button"),
  toast: document.querySelector("#toast"),
};

const state = {
  drafts: [],
  parseMode: "smart",
  parseStrategy: "empty",
  items: [],
  sceneImages: new Map(),
  busy: false,
  toastTimer: null,
};

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2800);
}

const STRATEGY_LABELS = {
  single: "识别为单独一条",
  markdown: "已按 Markdown 标题拆分",
  list: "已按编号或项目符号拆分",
  blank: "已按空行分段",
  "line-fallback": "未发现分隔标记，已按每行一条拆分",
  line: "已按每行一条拆分",
  paragraph: "已合并为整段一条",
  manual: "已人工调整拆分结果",
};

function cleanDrafts() {
  return state.drafts
    .map((lines) => lines.map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length);
}

function updateDraftStatus() {
  const notices = cleanDrafts();
  const count = notices.length;
  elements.count.textContent = String(count);
  elements.inputMessage.classList.toggle("is-error", count > MAX_NOTICES);
  elements.reparseButton.disabled = !elements.input.value.trim();

  if (count === 0) {
    elements.inputMessage.textContent = "粘贴后会自动显示拆分结果";
  } else if (count > MAX_NOTICES) {
    elements.inputMessage.textContent = `预览中有 ${count} 条，请删减到 ${MAX_NOTICES} 条以内`;
  } else {
    const warnings = notices.filter((lines) => getNoticeWarning(lines)).length;
    const strategy = STRATEGY_LABELS[state.parseStrategy] || "已完成拆分";
    elements.inputMessage.textContent = warnings
      ? `${strategy}：${count} 条，其中 ${warnings} 条文字较多`
      : `${strategy}：${count} 条，可继续编辑`;
  }
  elements.generateButton.disabled = count === 0 || count > MAX_NOTICES || state.busy;
}

function createDraftCard(lines, index) {
  const card = document.createElement("article");
  card.className = "draft-card";
  card.innerHTML = `
    <div class="draft-number">${String(index + 1).padStart(2, "0")}</div>
    <div class="draft-content">
      <div class="draft-card-head">
        <span class="draft-meta"></span>
        <div class="draft-card-actions">
          <button class="merge-draft" type="button" ${index === 0 ? "disabled" : ""}>并入上一条</button>
          <button class="split-draft" type="button">按换行拆开</button>
          <button class="delete-draft" type="button">删除</button>
        </div>
      </div>
      <textarea class="draft-copy" aria-label="编辑拆分结果第 ${index + 1} 条" rows="3"></textarea>
      <p class="draft-warning"></p>
    </div>
  `;
  const textarea = card.querySelector(".draft-copy");
  const meta = card.querySelector(".draft-meta");
  const warning = card.querySelector(".draft-warning");
  textarea.value = lines.join("\n");

  const refreshCard = () => {
    const currentLines = textarea.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    state.drafts[index] = currentLines;
    meta.textContent = `${currentLines.length || 0} 行 · ${currentLines.join("").length} 字`;
    warning.textContent = currentLines.length ? getNoticeWarning(currentLines) : "这条是空的，生成时会忽略";
    card.classList.toggle("is-empty", currentLines.length === 0);
    card.querySelector(".split-draft").disabled = currentLines.length < 2;
    updateDraftStatus();
  };

  textarea.addEventListener("input", refreshCard);
  card.querySelector(".delete-draft").addEventListener("click", () => {
    state.drafts.splice(index, 1);
    renderDraftPreview();
  });
  card.querySelector(".merge-draft").addEventListener("click", () => {
    if (index === 0) return;
    state.drafts[index - 1] = [...state.drafts[index - 1], ...state.drafts[index]];
    state.drafts.splice(index, 1);
    state.parseStrategy = "manual";
    renderDraftPreview();
  });
  card.querySelector(".split-draft").addEventListener("click", () => {
    const split = state.drafts[index].filter(Boolean).map((line) => [line]);
    if (split.length < 2) return;
    state.drafts.splice(index, 1, ...split);
    state.parseStrategy = "manual";
    renderDraftPreview();
  });
  refreshCard();
  return card;
}

function renderDraftPreview() {
  elements.draftList.replaceChildren();
  elements.draftEmpty.hidden = state.drafts.length > 0;
  elements.draftList.hidden = state.drafts.length === 0;
  state.drafts.forEach((lines, index) => elements.draftList.append(createDraftCard(lines, index)));
  updateDraftStatus();
}

function reparseInput() {
  const parsed = parseNoticeDocument(elements.input.value, state.parseMode);
  state.drafts = parsed.notices.map((lines) => [...lines]);
  state.parseStrategy = parsed.strategy;
  renderDraftPreview();
}

function updateInputState() {
  updateDraftStatus();
}

function renderSceneReel() {
  const fragment = document.createDocumentFragment();
  SCENES.forEach((scene, index) => {
    const item = document.createElement("div");
    item.className = "scene-chip";
    item.innerHTML = `
      <img src="${scene.src}" alt="${scene.name}" loading="lazy">
      <span>${String(index + 1).padStart(2, "0")} · ${scene.name}</span>
    `;
    fragment.append(item);
  });
  elements.sceneReel.replaceChildren(fragment);
}

function loadScene(sceneIndex) {
  const scene = SCENES[sceneIndex];
  if (state.sceneImages.has(scene.id)) return state.sceneImages.get(scene.id);

  const promise = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`无法加载场景：${scene.name}`));
    image.src = scene.src;
  });
  state.sceneImages.set(scene.id, promise);
  return promise;
}

function wrapCharacters(context, text, maxWidth) {
  if (!text) return [];
  const lines = [];
  let current = "";
  for (const character of [...text]) {
    const candidate = current + character;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function calculateTextLayout(context, sourceLines) {
  const maxWidth = 1360;
  const maxHeight = 590;
  for (let fontSize = 108; fontSize >= 44; fontSize -= 2) {
    context.font = `800 ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
    const lines = sourceLines.flatMap((line) => wrapCharacters(context, line, maxWidth));
    const lineHeight = fontSize * 1.3;
    if (lines.length * lineHeight <= maxHeight) {
      return { fontSize, lineHeight, lines };
    }
  }
  context.font = `800 42px "PingFang SC", "Microsoft YaHei", sans-serif`;
  return {
    fontSize: 42,
    lineHeight: 54,
    lines: sourceLines.flatMap((line) => wrapCharacters(context, line, maxWidth)),
  };
}

function createNoticeCanvas(lines) {
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  const layout = calculateTextLayout(context, lines);
  context.font = `800 ${layout.fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
  context.fillStyle = "#171815";
  context.textAlign = "center";
  context.textBaseline = "middle";
  const firstY = canvas.height / 2 - ((layout.lines.length - 1) * layout.lineHeight) / 2;
  layout.lines.forEach((line, index) => {
    context.fillText(line, canvas.width / 2, firstY + index * layout.lineHeight);
  });
  return canvas;
}

function bilinearPoint(corners, u, v) {
  const [topLeft, topRight, bottomRight, bottomLeft] = corners;
  const top = {
    x: topLeft.x + (topRight.x - topLeft.x) * u,
    y: topLeft.y + (topRight.y - topLeft.y) * u,
  };
  const bottom = {
    x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * u,
    y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * u,
  };
  return {
    x: top.x + (bottom.x - top.x) * v,
    y: top.y + (bottom.y - top.y) * v,
  };
}

function drawTexturedTriangle(context, image, source, destination) {
  const [s0, s1, s2] = source;
  const [d0, d1, d2] = destination;
  const denominator = s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 0.0001) return;

  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator;
  const e = (d0.x * (s1.x * s2.y - s2.x * s1.y) + d1.x * (s2.x * s0.y - s0.x * s2.y) + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator;
  const f = (d0.y * (s1.x * s2.y - s2.x * s1.y) + d1.y * (s2.x * s0.y - s0.x * s2.y) + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator;

  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.setTransform(a, b, c, d, e, f);
  context.drawImage(image, 0, 0);
  context.restore();
}

function warpNotice(context, noticeCanvas, corners) {
  const columns = 12;
  const rows = 7;
  const sourceWidth = noticeCanvas.width;
  const sourceHeight = noticeCanvas.height;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u0 = column / columns;
      const u1 = (column + 1) / columns;
      const v0 = row / rows;
      const v1 = (row + 1) / rows;
      const s00 = { x: u0 * sourceWidth, y: v0 * sourceHeight };
      const s10 = { x: u1 * sourceWidth, y: v0 * sourceHeight };
      const s11 = { x: u1 * sourceWidth, y: v1 * sourceHeight };
      const s01 = { x: u0 * sourceWidth, y: v1 * sourceHeight };
      const d00 = bilinearPoint(corners, u0, v0);
      const d10 = bilinearPoint(corners, u1, v0);
      const d11 = bilinearPoint(corners, u1, v1);
      const d01 = bilinearPoint(corners, u0, v1);
      drawTexturedTriangle(context, noticeCanvas, [s00, s10, s11], [d00, d10, d11]);
      drawTexturedTriangle(context, noticeCanvas, [s00, s11, s01], [d00, d11, d01]);
    }
  }
}

async function renderComposite(canvas, item, width = PREVIEW_WIDTH) {
  const height = Math.round(width * 4 / 3);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  const scene = SCENES[item.sceneIndex];
  const image = await loadScene(item.sceneIndex);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const [sourceWidth, sourceHeight] = scene.sourceSize;
  const corners = scene.corners.map(([x, y]) => ({
    x: x / sourceWidth * width,
    y: y / sourceHeight * height,
  }));
  warpNotice(context, createNoticeCanvas(item.lines), corners);
}

function updateDownloadButton() {
  const selectedCount = state.items.filter((item) => item.selected).length;
  elements.downloadAllButton.disabled = selectedCount === 0 || state.busy;
  elements.downloadAllButton.textContent = selectedCount
    ? `下载选中 ZIP（${selectedCount}）`
    : "下载选中 ZIP";
}

function createResultCard(item, index) {
  const card = document.createElement("article");
  card.className = "result-card";
  card.dataset.index = String(index);
  card.innerHTML = `
    <div class="card-preview">
      <canvas aria-label="第 ${index + 1} 张封面预览"></canvas>
      <label class="select-cover" title="选中此图">
        <input type="checkbox" ${item.selected ? "checked" : ""} aria-label="选中第 ${index + 1} 张">
      </label>
      <span class="card-index">${String(index + 1).padStart(2, "0")}</span>
    </div>
    <div class="card-body">
      <div class="scene-name">
        <span>${SCENES[item.sceneIndex].name}</span>
        <button class="change-scene" type="button">换场景</button>
      </div>
      <textarea class="card-copy" aria-label="编辑第 ${index + 1} 条通知">${item.lines.join("\n")}</textarea>
      <p class="warning">${getNoticeWarning(item.lines)}</p>
      <div class="card-actions">
        <button class="rerender" type="button">重新排版</button>
        <button class="download-one" type="button">下载 PNG</button>
      </div>
    </div>
  `;

  const canvas = card.querySelector("canvas");
  const checkbox = card.querySelector("input[type=checkbox]");
  const textArea = card.querySelector(".card-copy");
  const warning = card.querySelector(".warning");
  const sceneName = card.querySelector(".scene-name span");

  checkbox.addEventListener("change", () => {
    item.selected = checkbox.checked;
    updateDownloadButton();
  });

  card.querySelector(".change-scene").addEventListener("click", async () => {
    item.sceneIndex = (item.sceneIndex + 1) % SCENES.length;
    sceneName.textContent = SCENES[item.sceneIndex].name;
    await renderComposite(canvas, item);
  });

  const updateItemText = async () => {
    item.lines = textArea.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!item.lines.length) item.lines = ["请输入通知文字"];
    warning.textContent = getNoticeWarning(item.lines);
    await renderComposite(canvas, item);
  };
  card.querySelector(".rerender").addEventListener("click", updateItemText);
  textArea.addEventListener("change", updateItemText);
  card.querySelector(".download-one").addEventListener("click", () => downloadSingle(item, index));
  return card;
}

async function renderResults() {
  elements.emptyState.hidden = true;
  elements.resultsGrid.hidden = false;
  elements.resultsGrid.replaceChildren();
  const cards = state.items.map((item, index) => createResultCard(item, index));
  cards.forEach((card) => elements.resultsGrid.append(card));

  for (let index = 0; index < cards.length; index += 1) {
    await renderComposite(cards[index].querySelector("canvas"), state.items[index]);
    if (index % 4 === 3) await new Promise((resolve) => requestAnimationFrame(resolve));
  }
  elements.resultSummary.textContent = `已生成 ${state.items.length} 张；可编辑文字、单独换场景，或一键打包。`;
  elements.reshuffleButton.disabled = false;
  updateDownloadButton();
}

async function generateBatch() {
  const notices = cleanDrafts();
  if (!notices.length || notices.length > MAX_NOTICES) return;

  state.busy = true;
  updateInputState();
  elements.generateButton.textContent = "正在生成…";
  try {
    const sceneIndexes = buildSceneSequence(notices.length, SCENES.length);
    state.items = notices.map((lines, index) => ({
      lines,
      sceneIndex: sceneIndexes[index],
      selected: true,
    }));
    await renderResults();
    document.querySelector("#results-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    showToast(`已生成 ${notices.length} 张封面`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "生成失败，请重试");
  } finally {
    state.busy = false;
    elements.generateButton.innerHTML = `用预览内容生成 <span aria-hidden="true">→</span>`;
    updateInputState();
    updateDownloadButton();
  }
}

async function reshuffleScenes() {
  if (!state.items.length) return;
  const sequence = buildSceneSequence(state.items.length, SCENES.length);
  state.items.forEach((item, index) => {
    item.sceneIndex = sequence[index];
  });
  await renderResults();
  showToast("已重新分配全部场景");
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("图片导出失败"));
    }, "image/png");
  });
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function createExportBlob(item) {
  const canvas = document.createElement("canvas");
  await renderComposite(canvas, item, EXPORT_WIDTH);
  if (canvas.height !== EXPORT_HEIGHT) throw new Error("导出尺寸校验失败");
  return canvasToBlob(canvas);
}

async function downloadSingle(item, index) {
  try {
    const blob = await createExportBlob(item);
    const name = `${String(index + 1).padStart(2, "0")}-${sanitizeFilename(item.lines[0])}.png`;
    triggerDownload(blob, name);
    showToast(`已下载 ${name}`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "下载失败");
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let current = value;
    for (let bit = 0; bit < 8; bit += 1) {
      current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
    }
    table[value] = current >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function writeUint32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function concatenate(chunks) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function createStoredZip(files) {
  const encoder = new TextEncoder();
  const localChunks = [];
  const centralChunks = [];
  let localOffset = 0;
  const { time, date } = dosDateTime();

  files.forEach(({ name, data }) => {
    const nameBytes = encoder.encode(name);
    const checksum = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0x0800);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, checksum);
    writeUint32(localView, 18, data.length);
    writeUint32(localView, 22, data.length);
    writeUint16(localView, 26, nameBytes.length);
    writeUint16(localView, 28, 0);
    local.set(nameBytes, 30);
    localChunks.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0x0800);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, checksum);
    writeUint32(centralView, 20, data.length);
    writeUint32(centralView, 24, data.length);
    writeUint16(centralView, 28, nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    central.set(nameBytes, 46);
    centralChunks.push(central);
    localOffset += local.length + data.length;
  });

  const centralData = concatenate(centralChunks);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralData.length);
  writeUint32(endView, 16, localOffset);
  writeUint16(endView, 20, 0);
  return new Blob([...localChunks, centralData, end], { type: "application/zip" });
}

function csvEscape(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function downloadSelectedZip() {
  const selected = state.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.selected);
  if (!selected.length || state.busy) return;

  state.busy = true;
  updateInputState();
  updateDownloadButton();
  elements.downloadAllButton.textContent = `正在打包 0/${selected.length}`;
  try {
    const files = [];
    const manifest = [["编号", "图片文件名", "课堂场景", "通知文案"]];
    for (let position = 0; position < selected.length; position += 1) {
      const { item, index } = selected[position];
      const filename = `${String(index + 1).padStart(2, "0")}-${sanitizeFilename(item.lines[0])}.png`;
      const blob = await createExportBlob(item);
      files.push({ name: filename, data: new Uint8Array(await blob.arrayBuffer()) });
      manifest.push([String(index + 1), filename, SCENES[item.sceneIndex].name, item.lines.join(" / ")]);
      elements.downloadAllButton.textContent = `正在打包 ${position + 1}/${selected.length}`;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const csv = "\ufeff" + manifest.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    files.push({ name: "生成清单.csv", data: new TextEncoder().encode(csv) });
    triggerDownload(createStoredZip(files), `课堂通知封面-${selected.length}张.zip`);
    showToast(`已打包 ${selected.length} 张封面`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "ZIP 打包失败");
  } finally {
    state.busy = false;
    updateInputState();
    updateDownloadButton();
  }
}

elements.input.addEventListener("input", reparseInput);
elements.parseModes.forEach((radio) => {
  radio.addEventListener("change", () => {
    if (!radio.checked) return;
    state.parseMode = radio.value;
    reparseInput();
  });
});
elements.reparseButton.addEventListener("click", reparseInput);
elements.addDraftButton.addEventListener("click", () => {
  state.drafts.push([""]);
  state.parseStrategy = "manual";
  renderDraftPreview();
  elements.draftList.querySelector(".draft-card:last-child textarea")?.focus();
});
elements.exampleButton.addEventListener("click", () => {
  elements.input.value = EXAMPLES;
  state.parseMode = "smart";
  elements.parseModes.forEach((radio) => { radio.checked = radio.value === "smart"; });
  reparseInput();
  elements.input.focus();
});
elements.generateButton.addEventListener("click", generateBatch);
elements.reshuffleButton.addEventListener("click", reshuffleScenes);
elements.downloadAllButton.addEventListener("click", downloadSelectedZip);

renderSceneReel();
reparseInput();
