import test from "ava";

import { ModuleResolution } from "../src/moduleResolution.js";

test("Resolve component path in dependency", async t => {
	let m = new ModuleResolution();
	m.setTagName("my-tag");

	t.is(m.resolve("npm:pretend"), "./node_modules/pretend/my-tag.webc");
	t.is(m.resolve("npm:pretend/real.webc"), "./node_modules/pretend/real.webc");
	t.is(m.resolve("npm:pretend/pretend"), "./node_modules/pretend/pretend/my-tag.webc");
	t.is(m.resolve("npm:pretend/pretend/real.webc"), "./node_modules/pretend/pretend/real.webc");
	t.is(m.resolve("npm:@11ty/pretend"), "./node_modules/@11ty/pretend/my-tag.webc");
	t.is(m.resolve("npm:@11ty/pretend/real"), "./node_modules/@11ty/pretend/real/my-tag.webc");
	t.is(m.resolve("npm:@11ty/pretend/real/real.webc"), "./node_modules/@11ty/pretend/real/real.webc");
});

test("Resolve component path in dependency with aliases", async t => {
	let m = new ModuleResolution();
	m.setTagName("my-tag");
	m.setAliases({
		"npm": "./test/fake_modules/"
	});

	t.is(m.resolve("npm:pretend"), "./test/fake_modules/pretend/my-tag.webc");
	t.is(m.resolve("npm:pretend/real.webc"), "./test/fake_modules/pretend/real.webc");
	t.is(m.resolve("npm:pretend/pretend"), "./test/fake_modules/pretend/pretend/my-tag.webc");
	t.is(m.resolve("npm:pretend/pretend/real.webc"), "./test/fake_modules/pretend/pretend/real.webc");
	t.is(m.resolve("npm:@11ty/pretend"), "./test/fake_modules/@11ty/pretend/my-tag.webc");
	t.is(m.resolve("npm:@11ty/pretend/real"), "./test/fake_modules/@11ty/pretend/real/my-tag.webc");
	t.is(m.resolve("npm:@11ty/pretend/real.webc"), "./test/fake_modules/@11ty/pretend/real.webc");
	t.is(m.resolve("npm:@11ty/pretend/pretend/real.webc"), "./test/fake_modules/@11ty/pretend/pretend/real.webc");
});

test("Resolve component path in dependency with aliases and a tagName", async t => {
	let m = new ModuleResolution();
	m.setTagName("syntax-highlight");
	m.setAliases({
		"npm": "./test/fake_modules/"
	});

	t.is(m.resolve("npm:pretend"), "./test/fake_modules/pretend/syntax-highlight.webc");
	t.is(m.resolve("npm:pretend/pretend"), "./test/fake_modules/pretend/pretend/syntax-highlight.webc");
	t.is(m.resolve("npm:pretend/pretend/real.webc"), "./test/fake_modules/pretend/pretend/real.webc");
	t.is(m.resolve("npm:@11ty/pretend"), "./test/fake_modules/@11ty/pretend/syntax-highlight.webc");
	t.is(m.resolve("npm:@11ty/pretend/real"), "./test/fake_modules/@11ty/pretend/real/syntax-highlight.webc");
	t.is(m.resolve("npm:@11ty/pretend/real/real.webc"), "./test/fake_modules/@11ty/pretend/real/real.webc");
});


test("Alias outside of the project throws error", async t => {
	let m = new ModuleResolution();
	m.setAliases({
		"npm": "../test/"
	});

	t.throws(() => {
		m.resolve("npm:pretend")
	}, {
		message: "Invalid import reference (must be in the project root), received: ../test/pretend"
	});
});

test("Import outside of the project throws error", async t => {
	let m = new ModuleResolution();

	t.throws(() => {
		m.resolve("../pretend.webc")
	}, {
		message: "Invalid import reference (must be in the project root), received: ../pretend.webc"
	});
});
