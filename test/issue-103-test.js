import test from "node:test";
import { WebC } from "../webc.js";

async function getSlotText(content) {
	let slotText;
	let component = new WebC();
	component.setContent(content);
	component.defineComponents("./test/stubs/issue-103/*.webc");
	component.setTransform("capture-slot", function(content) {
		slotText = this.slots.text.default;
		return content;
	});

	await component.compile();
	return slotText;
}

test("slots.text.default with element children at the top level #103", async t => {
	t.assert.strictEqual(await getSlotText(`<capture-slot><b>Bold</b> text</capture-slot>`), "<b>Bold</b> text");
});

test("slots.text.default with element children in a nested component #103", async t => {
	t.assert.strictEqual(await getSlotText(`<nested-host></nested-host>`), "<b>Bold</b> text");
});

test("slots.text.default with a passthrough slot in a nested component #103", async t => {
	t.assert.strictEqual(await getSlotText(`<passthrough-host>Passed</passthrough-host>`), "<slot></slot>");
});
