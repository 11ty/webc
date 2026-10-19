import test from "node:test";

import { AttributeSerializer } from "../src/attributeSerializer.js";

// Inputs are guaranteed to be lower case (per the HTML specification)
test("Normalize attribute", async t => {
	t.assert.deepStrictEqual(await AttributeSerializer.evaluateAttribute("test", "value"), { name: "test", value: "value", evaluation: false, privacy: "public", rawName: "test", rawValue: "value" });
	t.assert.deepStrictEqual(await AttributeSerializer.evaluateAttribute("@test", "value"), { name: "test", value: "value", evaluation: false, privacy: "private", rawName: "@test", rawValue: "value" });
	t.assert.deepStrictEqual(await AttributeSerializer.evaluateAttribute(":test", "value", { value: 1 }), { name: "test", value: 1, evaluation: "script", privacy: "public", rawName: ":test", rawValue: "value" });
});

test("Normalize attribute name", async t => {
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("test"), "test");
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("my-test"), "myTest");
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("my-other-test"), "myOtherTest");
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("my-other--test"), "myOtherTest");
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("my-_other-test"), "my_otherTest");
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("-my-other-test"), "MyOtherTest");
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("my-other-test-"), "myOtherTest");
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("my-other-test------"), "myOtherTest");
	t.assert.strictEqual(AttributeSerializer.camelCaseAttributeName("m-y-other-test"), "mYOtherTest");
});

test("Normalize attributes for data", async t => {
	t.assert.deepStrictEqual(await AttributeSerializer.normalizeAttributesForData({"test": 1 }), {"test": 1 });
	t.assert.deepStrictEqual(await AttributeSerializer.normalizeAttributesForData({"my-test": 1 }), {"myTest": 1 });
	t.assert.deepStrictEqual(await AttributeSerializer.normalizeAttributesForData({"my-other-test": 1 }), {"myOtherTest": 1 });
});
