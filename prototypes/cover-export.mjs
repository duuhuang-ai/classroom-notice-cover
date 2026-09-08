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
  const [p0,p1,p2,p3] = corners;
  const dx1=p1.x-p2.x, dx2=p3.x-p2.x, dx3=p0.x-p1.x+p2.x-p3.x;
  const dy1=p1.y-p2.y, dy2=p3.y-p2.y, dy3=p0.y-p1.y+p2.y-p3.y;
  const det=dx1*dy2-dx2*dy1;
  const g=(dx3*dy2-dx2*dy3)/det, h=(dx1*dy3-dx3*dy1)/det;
  const q=g*u+h*v+1;
  return {x:((p1.x-p0.x+g*p1.x)*u+(p3.x-p0.x+h*p3.x)*v+p0.x)/q,
    y:((p1.y-p0.y+g*p1.y)*u+(p3.y-p0.y+h*p3.y)*v+p0.y)/q};
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
  const columns = 32;
  const rows = 18;
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


export { createStoredZip };
export async function renderCover(scene, text) {
  await document.fonts.ready;
  const image = new Image(); image.src=scene.src;
  try {await image.decode();} catch {throw new Error("场景图片加载失败，请重试或更换背景");}
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1440;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,1080,1440);
  let points=scene.corners;
  if(!points) {
    const x=parseFloat(scene.left)/100,y=parseFloat(scene.top)/100;
    const w=parseFloat(scene.width)/100,h=parseFloat(scene.height)/100;
    points=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  }
  warpNotice(ctx,createNoticeCanvas(text.split(/\r?\n/).filter(Boolean)),points.map(([x,y])=>({x:x*1080,y:y*1440})));
  return canvas;
}
export function pngBlob(canvas) {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片导出失败')),'image/png'));
}
export function saveBlob(blob,name) {
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
