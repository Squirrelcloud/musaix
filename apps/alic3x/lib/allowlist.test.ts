import { it } from "node:test";
import assert from "node:assert/strict";
import { emailAllowed } from "./allowlist.ts";

it("allow-list is fail-closed in production", () => {
  assert.equal(emailAllowed("a@b.co", undefined, true), false);
  assert.equal(emailAllowed("a@b.co", " ", true), false);
  assert.equal(emailAllowed("a@b.co", undefined, false), true);
  assert.equal(emailAllowed("A@B.co", "x@y.z, a@b.co", true), true);
  assert.equal(emailAllowed("c@d.co", "a@b.co", true), false);
  assert.equal(emailAllowed(undefined, "a@b.co", true), false);
});
