function normalizedLines(input) {
  return String(input ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim());
}

function isGenericMarker(value) {
  return /^(?:通知|文案|内容)?\s*(?:第?\s*[一二三四五六七八九十百\d]+\s*条?)?\s*[:：]?$/.test(value)
    && /(?:通知|文案|内容|条|[一二三四五六七八九十百\d])/.test(value);
}

function stripListMarker(line) {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^(?:\d{1,2}[.、)、:：]|[-*+]\s+)\s*/, "")
    .trim();
}

function parseByMarkdownHeadings(lines) {
  const headings = lines
    .map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      return match ? { index, level: match[1].length, title: match[2].trim() } : null;
    })
    .filter(Boolean);
  if (headings.length < 2) return null;

  const counts = new Map();
  headings.forEach(({ level }) => counts.set(level, (counts.get(level) || 0) + 1));
  const splitLevel = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([left], [right]) => left - right)[0]?.[0];
  if (!splitLevel) return null;

  const boundaries = headings.filter(({ level }) => level === splitLevel);
  return boundaries.map((heading, boundaryIndex) => {
    const end = boundaries[boundaryIndex + 1]?.index ?? lines.length;
    const body = lines.slice(heading.index + 1, end).filter(Boolean);
    return isGenericMarker(heading.title) ? body : [heading.title, ...body];
  }).filter((notice) => notice.length);
}

function parseByListMarkers(lines) {
  const markerPattern = /^(?:\d{1,2}[.、)、:：]\s*|[-*+]\s+)(.*)$/;
  const markerCount = lines.filter((line) => markerPattern.test(line)).length;
  if (markerCount < 2) return null;

  const notices = [];
  let current = null;
  lines.forEach((line) => {
    if (!line) return;
    const match = line.match(markerPattern);
    if (match) {
      if (current?.length) notices.push(current);
      const firstLine = stripListMarker(line);
      current = firstLine ? [firstLine] : [];
      return;
    }
    if (current) current.push(line);
  });
  if (current?.length) notices.push(current);
  return notices;
}

export function parseNoticeDocument(input, mode = "smart") {
  const lines = normalizedLines(input);
  const nonEmpty = lines.filter(Boolean);
  if (!nonEmpty.length) return { notices: [], strategy: "empty" };

  if (mode === "paragraph") {
    return { notices: [nonEmpty.map(stripListMarker).filter(Boolean)], strategy: "paragraph" };
  }
  if (mode === "line") {
    return {
      notices: nonEmpty.map(stripListMarker).filter(Boolean).map((line) => [line]),
      strategy: "line",
    };
  }

  const markdown = parseByMarkdownHeadings(lines);
  if (markdown) return { notices: markdown, strategy: "markdown" };

  const list = parseByListMarkers(lines);
  if (list) return { notices: list, strategy: "list" };

  if (lines.some((line) => !line)) {
    const notices = lines.join("\n")
      .split(/\n[\t ]*\n+/)
      .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
      .filter((notice) => notice.length);
    return { notices, strategy: "blank" };
  }

  if (nonEmpty.length === 1) return { notices: [[nonEmpty[0]]], strategy: "single" };
  return { notices: nonEmpty.map((line) => [line]), strategy: "line-fallback" };
}

export function parseNotices(input, mode = "smart") {
  return parseNoticeDocument(input, mode).notices;
}

export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function buildSceneSequence(count, sceneCount, random = Math.random) {
  if (!Number.isInteger(count) || count < 0) throw new Error("数量必须是非负整数");
  if (!Number.isInteger(sceneCount) || sceneCount < 1) throw new Error("至少需要一个场景");

  const sequence = [];
  const indexes = Array.from({ length: sceneCount }, (_, index) => index);
  while (sequence.length < count) {
    const cycle = shuffle(indexes, random);
    const previous = sequence.at(-1);
    if (sceneCount > 1 && cycle[0] === previous) {
      const swapIndex = cycle.findIndex((value) => value !== previous);
      [cycle[0], cycle[swapIndex]] = [cycle[swapIndex], cycle[0]];
    }
    sequence.push(...cycle);
  }
  return sequence.slice(0, count);
}

export function getNoticeWarning(lines) {
  const characters = lines.join("").length;
  if (lines.length > 4) return `当前 ${lines.length} 行，建议压缩到 4 行以内`;
  if (characters > 64) return `当前 ${characters} 个字，导出时字号会较小`;
  return "";
}

export function sanitizeFilename(value, fallback = "通知") {
  const cleaned = String(value ?? "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 24);
  return cleaned || fallback;
}
