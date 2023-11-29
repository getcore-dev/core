const assert = require("assert");
const isDevelopment = require("../index").isDevelopment;

describe("isDevelopment", function () {
  it('returns true when NODE_ENV is "development"', function () {
    process.env.NODE_ENV = "development";
    assert.strictEqual(isDevelopment(), true);
  });

  it('returns false when NODE_ENV is not "development"', function () {
    process.env.NODE_ENV = "production";
    assert.strictEqual(isDevelopment(), false);
  });
});
