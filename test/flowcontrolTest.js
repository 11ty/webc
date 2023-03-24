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

test("Using webc:if=false on a style", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<style webc:if="false">* { color: red }</style>Test`);

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);
	t.deepEqual(components, []);

	t.is(html, `Test`);
});

test("Using webc:if=true on a style", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<style webc:if="true">* { color: red }</style>Test`);

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, [`* { color: red }`]);
	t.deepEqual(components, []);

	t.is(html, `Test`);
});

test("Using webc:if on a style based on host component attribute (true)", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<if-component-style :@attr-value="true"></if-component-style>`);
	component.defineComponents("./test/stubs/if-component-style.webc");

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, [`* { color: red }`]);

	t.is(html, `<if-component-style>Test</if-component-style>`);
});

test("Using webc:if on a style based on host component attribute (false)", async t => {
	let component = new WebC();

	component.setBundlerMode(true);
	component.setContent(`<if-component-style :@attr-value="false"></if-component-style>`);
	component.defineComponents("./test/stubs/if-component-style.webc");

	let { html, css, js, components } = await component.compile();

	t.deepEqual(js, []);
	t.deepEqual(css, []);

	t.is(html, `<if-component-style>Test</if-component-style>`);
});

test("Using webc:if=false web:else", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="false">Hi</div>
		<div webc:else>Bye</div>
	</body>
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
		
		<div>Bye</div>
	
</body>
</html>`);
});

test("Using webc:if=true web:else", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="true">Hi</div>
		<div webc:else>Bye</div>
	</body>
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
		<div>Hi</div>
		
	
</body>
</html>`);
});

test("Using webc:if=true webc:elseif=false web:else", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="true">Hi</div>
		<div webc:elseif="true">Yo</div>
		<div webc:else>Bye</div>
	</body>
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
		<div>Hi</div>
		
		
	
</body>
</html>`);
});

test("Using webc:if=false webc:elseif=true web:else", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="false">Hi</div>
		<div webc:elseif="true">Yo</div>
		<div webc:else>Bye</div>
	</body>
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
		
		<div>Yo</div>
		
	
</body>
</html>`);
});

test("Using webc:if=false webc:elseif=false web:else", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="false">Hi</div>
		<div webc:elseif="false">Yo</div>
		<div webc:else>Bye</div>
	</body>
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
		
		
		<div>Bye</div>
	
</body>
</html>`);
});

test("Using webc:if=true webc:elseif=true web:else", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="true">Hi</div>
		<div webc:elseif="true">Yo</div>
		<div webc:else>Bye</div>
	</body>
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
		<div>Hi</div>
		
		
	
</body>
</html>`);
});

test("Solo webc:else throws an error", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="true">Hi</div>
		<div>Yo</div>
		<div webc:else>Bye</div>
	</body>
</html>`);

	await t.throwsAsync(component.compile(), {
		message: `webc:else expected an webc:if or webc:elseif on the previous sibling!`
	});
});

test("Solo webc:elseif throws an error", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="false">Hi</div>
		<div>Yo</div>
		<div webc:elseif>Bye</div>
	</body>
</html>`);

	await t.throwsAsync(component.compile(), {
		message: `webc:elseif expected an webc:if or webc:elseif on the previous sibling!`
	});
});

test("Flow control works fine with comments in the middle", async t => {
	let component = new WebC();

	component.setContent(`<!doctype html>
<html>
	<body>
		<div webc:if="false">Hi</div>
		<!-- this works okay -->
		<div webc:else>Bye</div>
	</body>
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
		
		<!-- this works okay -->
		<div>Bye</div>
	
</body>
</html>`);
});