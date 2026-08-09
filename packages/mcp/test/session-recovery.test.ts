import assert from "node:assert/strict";
import test from "node:test";
import { SessionRecoveryGate } from "../src/sessionRecovery.js";

test("allows one automatic handoff per agent id and then blocks a loop", () => {
  const gate = new SessionRecoveryGate();

  assert.equal(gate.markInitialRegistration("expert"), true);
  assert.equal(gate.markInitialRegistration("expert"), false);
  assert.equal(gate.markInitialRegistration("codex"), true);
});
