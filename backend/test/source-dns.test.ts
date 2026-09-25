import test from "node:test";
import assert from "node:assert/strict";
import { pinnedLookup } from "../src/web.js";

test("Pinned source DNS supports Node single-address and all-address lookup requests", () => {
  const lookup = pinnedLookup("93.184.216.34");
  lookup("example.com", {all:true}, (error, addresses) => {
    assert.equal(error,null);
    assert.deepEqual(addresses,[{address:"93.184.216.34",family:4}]);
  });
  lookup("example.com", {all:false}, (error,address,family) => {
    assert.equal(error,null);
    assert.equal(address,"93.184.216.34");
    assert.equal(family,4);
  });
});
