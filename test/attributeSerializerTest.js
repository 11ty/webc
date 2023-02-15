import test from "ava";

import { AttributeSerializer } from "../src/attributeSerializer.js";

// Inputs are guaranteed to be lower case (per the HTML specification)
test("Normalize attribute", async t => {
	t.deepEqual(await AttributeSerializer.evaluateAttribute("test", "value"), { name: "test", value: "value", evaluation: false, privacy: "public", rawName: "test", rawValue: "value" });
	t.deepEqual(await AttributeSerializer.evaluateAttribute("@test", "value"), { name: "test", value: "value", evaluation: false, privacy: "private", rawName: "@test", rawValue: "value" });
	t.deepEqual(await AttributeSerializer.evaluateAttribute(":test", "value", { value: 1 }), { name: "test", value: 1, evaluation: "script", privacy: "public", rawName: ":test", rawValue: "value" });
});

test("Normalize attribute name", async t => {
	t.is(AttributeSerializer.camelCaseAttributeName("test"), "test");
	t.is(AttributeSerializer.camelCaseAttributeName("my-test"), "myTest");
	t.is(AttributeSerializer.camelCaseAttributeName("my-other-test"), "myOtherTest");
	t.is(AttributeSerializer.camelCaseAttributeName("my-other--test"), "myOtherTest");
	t.is(AttributeSerializer.camelCaseAttributeName("my-_other-test"), "my_otherTest");
	t.is(AttributeSerializer.camelCaseAttributeName("-my-other-test"), "MyOtherTest");
	t.is(AttributeSerializer.camelCaseAttributeName("my-other-test-"), "myOtherTest");
	t.is(AttributeSerializer.camelCaseAttributeName("my-other-test------"), "myOtherTest");
});

test("Normalize attributes for data", async t => {
	t.deepEqual(await AttributeSerializer.normalizeAttributesForData({"test": 1 }), {"test": 1 });
	t.deepEqual(await AttributeSerializer.normalizeAttributesForData({"my-test": 1 }), {"myTest": 1 });
	t.deepEqual(await AttributeSerializer.normalizeAttributesForData({"my-other-test": 1 }), {"myOtherTest": 1 });
});
