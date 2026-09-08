import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSceneSequence,
  getNoticeWarning,
  parseNoticeDocument,
  parseNotices,
  sanitizeFilename,
} from "../logic.mjs";

test("用空行分隔多条通知，保留每条内部换行", () => {
  assert.deepEqual(parseNotices("第一行\n第二行\n\n第二条\n请集合"), [
    ["第一行", "第二行"],
    ["第二条", "请集合"],
  ]);
});

test("忽略空白块和行首行尾空格", () => {
  assert.deepEqual(parseNotices("  通知A  \n\n\n  通知B\n  内容  "), [
    ["通知A"],
    ["通知B", "内容"],
  ]);
});

test("单独一句会识别为一条通知", () => {
  assert.deepEqual(parseNotices("18号同学"), [["18号同学"]]);
});

test("Markdown 二级标题会拆分，通用编号标题不会进入正文", () => {
  assert.deepEqual(parseNotices("# 班级通知合集\n\n## 通知1\n18号同学\n请到办公室\n\n## 通知2\n今天下午上班会课"), [
    ["18号同学", "请到办公室"],
    ["今天下午上班会课"],
  ]);
});

test("数字编号和项目符号会拆成多条", () => {
  assert.deepEqual(parseNotices("1. 18号同学请到办公室\n2. 今天下午上班会课"), [
    ["18号同学请到办公室"],
    ["今天下午上班会课"],
  ]);
  assert.deepEqual(parseNotices("- 请带语文书\n- 请交数学作业"), [
    ["请带语文书"],
    ["请交数学作业"],
  ]);
});

test("连续多行可切换每行一条或整段一条", () => {
  assert.deepEqual(parseNotices("第一句\n第二句", "smart"), [["第一句"], ["第二句"]]);
  assert.deepEqual(parseNotices("第一句\n第二句", "line"), [["第一句"], ["第二句"]]);
  assert.deepEqual(parseNotices("第一句\n第二句", "paragraph"), [["第一句", "第二句"]]);
  assert.equal(parseNoticeDocument("第一句\n第二句", "smart").strategy, "line-fallback");
});

test("两轮场景不在轮次边界连续重复", () => {
  const values = [0.99, 0.82, 0.71, 0.64, 0.55, 0.49, 0.33, 0.21, 0.12, 0.04];
  let cursor = 0;
  const random = () => values[(cursor += 1) % values.length];
  const sequence = buildSceneSequence(20, 10, random);
  assert.equal(sequence.length, 20);
  for (let index = 1; index < sequence.length; index += 1) {
    assert.notEqual(sequence[index], sequence[index - 1]);
  }
  assert.equal(new Set(sequence.slice(0, 10)).size, 10);
  assert.equal(new Set(sequence.slice(10, 20)).size, 10);
});

test("超过4行和过长文案会返回警告", () => {
  assert.match(getNoticeWarning(["1", "2", "3", "4", "5"]), /5 行/);
  assert.match(getNoticeWarning(["很长".repeat(40)]), /字号会较小/);
  assert.equal(getNoticeWarning(["正常通知", "请按时到达"]), "");
});

test("文件名会移除不合法字符并限制长度", () => {
  assert.equal(sanitizeFilename('通知:/?*"<>|'), "通知");
  assert.ok(sanitizeFilename("课堂通知".repeat(20)).length <= 24);
});
