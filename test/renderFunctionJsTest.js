import test from "ava";
import { WebC } from "../webc.js";

test("Using webc:type=js", async t => {
	let component = new WebC();

	// identical to <script webc:nokeep @html="myArray.join('/')"></script>
	component.setContent(`<!doctype html>
<html>
	<body><script webc:type="js">export default function({myArray}) {
		return myArray.join("/");
	}</script></body>
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

	// Needs a filePath for require/import
	component.setInputPath("./component.webc");

	// identical to <script webc:nokeep @html="myArray.join('/')"></script>
	component.setContent(`<!doctype html>
<html>
	<body>
	<script webc:type="js">
	const test = require("./test/stubs/sample-require.cjs");
	export default test;
	</script>
	</body>
</html>`);

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, ["./component.webc"]);

	t.is(html, `<!doctype html>
<html>
<head></head><body>
	Imported
	
</body>
</html>`);
});

// Seems like this ignores webc:type and outputs the <script>—is this what we want?
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
<head></head><body>1/2/3/4
</body>
</html>`);
});

test("Using webc:type=js and promises", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
	<script webc:type="js">
	export default function({myArray}) {
		return new Promise(resolve => {
			setTimeout(function() {
				resolve(myArray)
			}, 50);
		});
	}
	</script>
	</body>
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
<head></head><body>
	1,2,3,4
	
</body>
</html>`);
});

test("Using webc:type=js and async function", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
	<script webc:type="js">
	async function test(myArray) {
		return new Promise(resolve => {
			setTimeout(function() {
				resolve(myArray)
			}, 50);
		});
	}
	export default function({ myArray }) {
		// yes this is an async function
		return test(myArray)
	}
	</script>
	</body>
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
<head></head><body>
	1,2,3,4
	
</body>
</html>`);
});


test("Using webc:type=js and if true", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
	<script webc:type="js">
	export default function() {
		if(true) {
			return "true";
		} else {
			return "false";
		}
	}
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
	true
	
</body>
</html>`);
});

test("Using webc:type=js and if false", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
	<script webc:type="js">
	export default function() {
		if(false) {
			return "true";
		} else {
			return "false";
		}
	}
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
	false
	
</body>
</html>`);
});
