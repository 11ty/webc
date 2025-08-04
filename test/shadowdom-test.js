import test from "ava";

import { WebC } from "../webc.js";

async function testGetResultFor(filename, components, slots, data) {
	let component = new WebC();

	component.setInputPath(filename);
	component.setBundlerMode(true);

	return component.compile({
		slots,
		components,
		data,
	});
}


test("Using a web component with a declarative shadow root", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/shadowroot.webc"
	}, {}, { globalData: "World" });

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/shadowroot.webc"
	]);
	t.is(html, `Before
<web-component><template shadowroot="open">
	<style>
		b { color: red; }
	</style>
	Hello <b>World</b>!
</template></web-component>
After`);
});

test("Using a web component with a declarative shadow root using shadowrootmode", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/shadowrootmode.webc"
	}, {}, { globalData: "World" });

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/shadowrootmode.webc"
	]);
	t.is(html, `Before
<web-component><template shadowrootmode="open">
	<style>
		b { color: red; }
	</style>
	Hello <b>World</b>!
</template></web-component>
After`);
});

test("Using a web component with a declarative shadow root using shadowrootmode and a slot", async t => {
	let { html, css, js, components } = await testGetResultFor("./test/stubs/nested.webc", {
		"web-component": "./test/stubs/components/shadowrootmode-slot.webc"
	}, {});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, [
		"./test/stubs/nested.webc",
		"./test/stubs/components/shadowrootmode-slot.webc"
	]);
	t.is(html, `Before
<web-component><template shadowrootmode="open">
	<style>
		b { color: red; }
	</style>
	Hello <b>World</b>!
</template>World</web-component>
After`);
});
