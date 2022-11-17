import test from "ava";
import { WebC } from "../webc.js";

test("Using webc:type=js", async t => {
	let component = new WebC();

	// identical to <script webc:nokeep @html="myArray.join('/')"></script>
	component.setContent(`<!doctype html>
<html>
	<body><script webc:type="js">myArray.join("/")</script></body>
</html>`);

	let { html, css, js, components } = await component.compile({
		data: {
			myArray: [1,2,3,4]
		}
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);

	t.is(html, `<!doctype html>
<html>
<head></head><body>1/2/3/4
</body>
</html>`);
});

test("Using webc:type=js with require", async t => {
	let component = new WebC();

	// identical to <script webc:nokeep @html="myArray.join('/')"></script>
	component.setContent(`<!doctype html>
<html>
	<body>
	<script webc:type="js">
	const test = require("./test/stubs/sample-require.cjs");
	test;
	</script>
	</body>
</html>`);

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);

	t.is(html, `<!doctype html>
<html>
<head></head><body>
	Imported
	
</body>
</html>`);
});

test("Using webc:type=js and @html", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body><script webc:type="js" @html="myArray.join('/')"></script></body>
</html>`);

	let { html, css, js, components } = await component.compile({
		data: {
			myArray: [1,2,3,4]
		}
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);

	t.is(html, `<!doctype html>
<html>
<head></head><body><script>1/2/3/4</script>
</body>
</html>`);
});