import test from "ava";
import { WebC } from "../webc.js";

test("Using webc:if=undefined", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body><div webc:if="myText">Hi</div></body>
</html>`);

	let { html, css, js, components } = await component.compile({
		data: {}
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

test("Using webc:if with a promise (resolves true)", async t => {
	let component = new WebC();
	component.setHelper("timeoutTrue", async () => {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve(true);
			}, 50);
		});
	})
	component.setContent(`<!doctype html>
<html>
	<body><div webc:if="timeoutTrue()">Hi</div></body>
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

test("Using webc:if with a promise (resolves false)", async t => {
	let component = new WebC();
	component.setHelper("timeoutTrue", async () => {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve(false);
			}, 50);
		});
	})
	component.setContent(`<!doctype html>
<html>
	<body><div webc:if="timeoutTrue()">Hi</div></body>
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
<head></head><body>
</body>
</html>`);
});
