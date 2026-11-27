import { describe, expect, it } from "vitest";
import { networkOf } from "../../utils/clientKey.js";

describe("networkOf", () => {
  it("keeps IPv4 as is, including IPv4-mapped IPv6", () => {
    expect(networkOf("203.0.113.9")).toBe("203.0.113.9");
    expect(networkOf("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });

  it("groups IPv6 addresses by their /64 network", () => {
    expect(networkOf("2001:db8:aa:1::5")).toBe("2001:db8:aa:1::/64");
    expect(networkOf("2001:0db8:00aa:0001:ffff:1:2:3")).toBe("2001:db8:aa:1::/64");
    expect(networkOf("2001:db8::1")).toBe("2001:db8:0:0::/64");
  });
});
