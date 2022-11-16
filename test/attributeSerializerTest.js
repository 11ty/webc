import test from "ava";

import { AttributeSerializer } from "../src/attributeSerializer.js";

// Inputs are guaranteed to be lower case (per the HTML specification)
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
	t.deepEqual(AttributeSerializer.normalizeAttributesForData({"test": 1 }), {"test": 1 });
	t.deepEqual(AttributeSerializer.normalizeAttributesForData({"my-test": 1 }), {"my-test": 1 });
	t.deepEqual(AttributeSerializer.normalizeAttributesForData({"my-other-test": 1 }), {"my-other-test": 1 });
});
