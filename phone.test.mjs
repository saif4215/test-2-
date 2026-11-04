// `npm run phone` picks this computer's Wi-Fi address for the QR code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lanAddress } from "./scripts/phone.mjs";

const nic = (address, internal = false, family = "IPv4") => ({ address, family, internal });
test("the phone address is the home or office network address, not a loopback, Docker or IPv6 one", () => {
  assert.equal(lanAddress({ lo: [nic("127.0.0.1", true)], en0: [nic("fe80::1", false, "IPv6"), nic("192.168.1.23")] }), "192.168.1.23");
  assert.equal(lanAddress({ docker0: [nic("172.17.0.1")], wlan: [nic("10.0.0.5")] }), "10.0.0.5", "10.x before 172.x");
  assert.equal(lanAddress({ vpn: [nic("100.64.1.2")], wifi: [nic("192.168.0.9")] }), "192.168.0.9", "192.168.x first");
  assert.equal(lanAddress({ only: [nic("203.0.113.7")] }), "203.0.113.7", "anything else is better than nothing");
  assert.equal(lanAddress({ lo: [nic("127.0.0.1", true)] }), "", "no network: an empty answer, so the script can say so");
});
