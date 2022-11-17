import test from "ava";
import { WebC } from "../webc.js";

test("Using webc:if=false", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body><div webc:if="myText">Hi</div></body>
</html>`);

	let { html, css, js, components } = await component.compile({
		data: {
			myText: false
		}
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);

	t.is(html, `<!doctype html>
<html>
<head></head><body>
</body>
</html>`);
});

test("Using webc:if=true", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body><div webc:if="myText">Hi</div></body>
</html>`);

	let { html, css, js, components } = await component.compile({
		data: {
			myText: true
		}
	});

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);

	t.is(html, `<!doctype html>
<html>
<head></head><body><div>Hi</div>
</body>
</html>`);
});
