import assert from "node:assert/strict";
import test from "node:test";
import { ENTRY_TEMPLATES, buildTemplatePatch, getEntryTemplate } from "../src/templates.js";

test("publishes unique built-in entry templates", () => {
  const ids = new Set(ENTRY_TEMPLATES.map((template) => template.id));

  assert.equal(ids.size, ENTRY_TEMPLATES.length);

  for (const template of ENTRY_TEMPLATES) {
    assert.ok(template.name);
    assert.ok(template.description);
    assert.ok(template.title);
    assert.ok(template.keys.length);
    assert.match(template.content, /## /);
  }
});

test("builds an independent entry patch from a template", () => {
  const template = getEntryTemplate("location");
  const patch = buildTemplatePatch(template);

  assert.equal(patch.title, "New location");
  assert.deepEqual(patch.keys, ["location name"]);
  assert.match(patch.content, /Notable places/);

  patch.keys.push("changed");
  assert.deepEqual(template.keys, ["location name"]);
  assert.equal(getEntryTemplate("missing"), null);
  assert.equal(buildTemplatePatch(null), null);
});
