import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClerkClient } from "@clerk/backend";

import { EmailDemo, createAssetServer } from "./email.mjs";
import { template, validateDocument, inlineNodes, formatSelection } from "./model.js";
import { renderDocument } from "./render.mjs";

test("all branded templates render sample GIF URLs, personalization, text and email-safe HTML", async () => {
  for (const id of ["ready", "community", "parts"]) {
    const doc = template(id);
    doc.firstName = "<script>alert(1)</script>";
    const output = await renderDocument(doc, "https://assets.example.com");
    assert.ok(output.html.includes("https://assets.example.com/"));
    assert.ok(output.html.includes(".gif"));
    assert.ok(output.html.includes("<table"));
    assert.ok(!output.html.includes("<script>"));
    assert.ok(output.text.includes("workshop.example.com"));
    assert.ok(output.bytes < 50000);
    if (id === "community") {
      assert.match(output.html, /Synthetic sample animation/);
    }
  }
  const bad = template();
  bad.blocks.find((block) => block.type === "button").url = "javascript:alert(1)";
  assert.throws(() => validateDocument(bad), /HTTPS/);
});

test("exported React Email module reproduces the exact HTML and text", async (t) => {
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = await mkdtemp(resolve(here, "../../.local/demo/export-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const doc = template("community");
  Object.assign(
    doc.blocks.find((block) => block.type === "text"),
    { align: "justify", text: "**Hello *builder* today**, __underlined__, ~~old~~. {{firstName}}" },
  );
  const result = await renderDocument(doc, "https://assets.example.com");
  const file = join(dir, "export.mjs");
  await writeFile(file, result.source);
  const exported = await import(pathToFileURL(file).href);
  assert.equal(exported.html, result.html);
  assert.equal(exported.text, result.text);
});

test("paragraph formatting renders safely, survives personalization and supports all alignments", async () => {
  const doc = template();
  const block = doc.blocks.find((item) => item.type === "text");
  block.text =
    "**Bold and *italic* together**; __underline__; ~~strike~~; <img src=x onerror=alert(1)> {{firstName}}";
  doc.firstName = "**plain personal data**";
  for (const align of ["left", "center", "right", "justify"]) {
    block.align = align;
    const output = await renderDocument(doc, "https://assets.example.com");
    assert.ok(output.html.includes(`text-align:${align}`));
    assert.ok(output.html.includes("<strong>Bold and <em>italic</em> together</strong>"));
    assert.ok(output.html.includes("<u>underline</u>"));
    assert.ok(output.html.includes("<s>strike</s>"));
    assert.ok(output.html.includes("&lt;img"));
    assert.ok(output.html.includes("**plain personal data**"));
    assert.ok(output.text.includes("Bold and italic together"));
  }
  block.align = "invalid";
  assert.throws(() => validateDocument(doc), /alignment/);
  assert.deepEqual(inlineNodes("unmatched ** stays literal"), ["unmatched ** stays literal"]);
  const formatted = formatSelection("hello world", 6, 11, "**");
  assert.equal(formatted.text, "hello **world**");
  assert.equal(
    formatSelection(formatted.text, formatted.start, formatted.end, "**").text,
    "hello world",
  );
  assert.equal(formatSelection("hello", 0, 0, "**").text, "hello");
});

test("real JS SDK and direct HTTP serialize the same frozen message and key", async (t) => {
  const calls = [];
  const provider = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
    }
    calls.push({ body: JSON.parse(raw), key: req.headers["idempotency-key"] });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ object: "email", id: "ema_mock_only", status: "queued" }));
  });
  await new Promise((done) => provider.listen(0, "127.0.0.1", done));
  t.after(() => new Promise((done) => provider.close(done)));
  const base = `http://127.0.0.1:${provider.address().port}`;
  const clerk = createClerkClient({ secretKey: "sk_live_TEST_ONLY", apiUrl: base });
  const dir = await mkdtemp(join(tmpdir(), "rack-studio-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const demo = new EmailDemo({
    secretKey: "sk_live_TEST_ONLY",
    domain: "example.com",
    statePath: join(dir, "state.json"),
    assetBase: "https://assets.example.com",
    fetchImpl: (_url, init) => fetch(`${base}/v1/email`, init),
    sdkImpl: (params, options) => clerk.emails.create(params, options),
  });
  await demo.act("send", {
    recipient: "user_demo123",
    recipientMode: "user",
    document: template(),
    replyTo: "support@example.org",
    cc: ["copy@example.org"],
    attachments: [{ filename: "hello.txt", content: "aGVsbG8=" }],
    transport: "api",
    key: "test_shared_key",
  });
  const retry = await demo.act("retry", { transport: "sdk" });
  assert.equal(retry.id, "ema_mock_only");
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1], calls[0]);
  assert.deepEqual(calls[0].body.to, { user_id: "user_demo123" });
  assert.equal(calls[0].body.reply_to.address, "support@example.org");
  assert.equal(calls[0].body.attachments[0].content, "aGVsbG8=");
  assert.equal(calls[0].key, "test_shared_key");
  await demo.act("reset");
  await assert.rejects(
    demo.act("send", { recipient: "bad", document: template() }),
    /valid recipient/,
  );
  assert.equal(calls.length, 2);
});

test("public asset server exposes only the two GIFs, never the composer, state or files", async (t) => {
  const server = createAssetServer();
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(() => new Promise((done) => server.close(done)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/", "/api/state", "/.env.local", "/email.mjs", "/rackmate-frame.png"]) {
    assert.equal((await fetch(base + path)).status, 404);
  }
  for (const path of ["/starter-rack.gif", "/compute-shelf.gif"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/gif");
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 6).toString(), "GIF89a");
  }
});
