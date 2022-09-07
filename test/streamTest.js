import test from "ava";
import { WebC } from "../webc.js";

async function getStreamChunks(readableStream) {
	return new Promise((resolve, reject) => {
		let data = [];

		readableStream.on("data", (chunk) => {
			data.push(chunk.toString());
		});
		

		readableStream.on("error", (error) => {
			reject(error);
		});

		readableStream.on("end", () => {
			resolve(data);
		});
	});
}

async function testGetStreamResultFor(filename, components, slots, data) {
	let webc = new WebC();
	webc.setInputPath(filename);

	let { streams } = await webc.stream({
		slots,
		components,
		data
	});

	return {
		streams,
		chunks: {
			html: await getStreamChunks(streams.html),
			css: await getStreamChunks(streams.css),
			js: await getStreamChunks(streams.js)
		}
	}
}

test("Empty file", async t => {
	let { streams, chunks } = await testGetStreamResultFor("./test/stubs/empty.webc");
	t.deepEqual( chunks.html.length, 0);
	t.is(chunks.html.join(""), "");
});

test("No top level <template> required", async t => {
	let { streams, chunks } = await testGetStreamResultFor("./test/stubs/no-template.webc");
	t.deepEqual( chunks.html.length, 2);
	t.is(chunks.html.join(""), `<div class="test"></div>`);
});

test("Image element", async t => {
	let { streams, chunks } = await testGetStreamResultFor("./test/stubs/img.webc");
	t.deepEqual( chunks.html.length, 1);
	t.is(chunks.html.join(""), `<img src="test.jpg">`);
});

test("HTML Comment", async t => {
	let { streams, chunks } = await testGetStreamResultFor("./test/stubs/comment.webc");
	t.deepEqual( chunks.html.length, 1);
	t.is(chunks.html.join(""), `<!-- comment -->`);
});

test("Un-nests nested links (same as web)", async t => {
	let { streams, chunks } = await testGetStreamResultFor("./test/stubs/nested-link.webc");
	t.deepEqual( chunks.html.length, 6);
	t.is(chunks.html.join(""), `<a href="#">Parent</a><a href="#">Child</a>`);
});

test("One empty <style>", async t => {
	let { streams, chunks } = await testGetStreamResultFor("./test/stubs/style.webc");
	t.deepEqual( chunks.html.length, 0);
	t.is(chunks.html.join(""), ``);
});

test.only("Using a top level <template>", async t => {
	let { streams, chunks } = await testGetStreamResultFor("./test/stubs/template.webc");

	console.log( chunks.html );
	t.is( chunks.html.join(""), `<template>
	<div class="test"></div>
</template>`);

	t.deepEqual( chunks.html.length, 3);
	t.deepEqual( chunks.css.length, 0);
	t.deepEqual( chunks.js.length, 0);
});

test("Components dependency graph ordering", async t => {
	let { streams, chunks } = await testGetStreamResultFor("./test/stubs/components-order.webc", {
		"my-grandparent": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-parent": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-me": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-child": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-aunt": "./test/stubs/components/nested-child-slot-before-after.webc",
		"my-sibling": "./test/stubs/components/nested-child-slot-before-after.webc",
	});

	t.deepEqual( chunks.html.length, 23);
	t.deepEqual( chunks.css.length, 0);
	t.deepEqual( chunks.js.length, 0);

	t.is( chunks.html.join(""), `Before
	Before
		Before
			BeforeCHILD CONTENTAfter
		After
		BeforeSIBLING CONTENTAfter
	After
	BeforeAUNT CONTENTAfter
After`);

});