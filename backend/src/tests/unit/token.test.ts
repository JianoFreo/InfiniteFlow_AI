import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "../../utils/token.js";

describe("token", () => {
  it("round-trips the user", () => {
    const payload = verifyToken(signToken({ id: 9, email: "x@y.z", name: "Ana" }));
    expect(payload).toMatchObject({ sub: 9, email: "x@y.z", name: "Ana" });
  });

  it("rejects tampered, malformed and expired tokens", () => {
    const token = signToken({ id: 9, email: "x@y.z", name: null });
    const [h, , s] = token.split(".");
    const evilBody = Buffer.from(JSON.stringify({ sub: 1, email: "x", name: null, exp: 9999999999 })).toString("base64url");
    expect(verifyToken(`${h}.${evilBody}.${s}`)).toBeNull();
    expect(verifyToken("nope")).toBeNull();

    const expiredBody = Buffer.from(JSON.stringify({ sub: 9, email: "x", name: null, exp: 1 })).toString("base64url");
    expect(verifyToken(`${h}.${expiredBody}.${s}`)).toBeNull();
  });
});
