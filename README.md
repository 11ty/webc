# WebC is for Single File Web Components

## Features

* Framework-independent standalone HTML serializer for generating markup for Web Components.
	* Expand any HTML element (including custom elements and web components) to HTML with defined conventions from web standards.
	* This means that Web Components created with WebC are compatible with server-side rendering (without duplicating author-written markup).
* Compilation tools to aggregate component-level assets (CSS or JS) for critical CSS or client JavaScript.
* Opt-in to scope your component CSS using WebC’s built-in CSS prefixer.
	* Or, use browser-native Shadow DOM style scoping (for future-compatibility when Declarative Shadow DOM browser support is ubiquitous)
* Progressive-enhancement friendly. 
* Streaming friendly.
* Shadow DOM friendly.
* Async friendly.

### Integrations/Plugins

* [`@11ty/eleventy-plugin-webc`](https://www.11ty.dev/docs/languages/webc/) adds WebC to [Eleventy](https://www.11ty.dev/)
* [`express-webc`](https://github.com/NickColley/express-webc) by [@NickColley](https://github.com/NickColley/) adds WebC to [Express](https://expressjs.com/)
* [`koa-webc`](https://github.com/sombriks/koa-webc) by [@sombriks](https://github.com/sombriks) adds WebC to [Koa](https://koajs.com/)

### Testimonials

> “javascript frameworks are dead to me”—[Andy Bell](https://twitter.com/hankchizljaw/status/1568301299623411715)

> “The DX and authoring model you landed on here looks fantastic”—[Addy Osmani](https://twitter.com/addyosmani/status/1568741911690899457)

> “Really like the programmatic API approach over using a bundler to pre-compile and then serve.”—[Harminder Virk](https://twitter.com/AmanVirk1/status/1568312188292546566)

### Similar Works

Folks doing similar things with Web Components: check them out!

* [Enhance](https://enhance.dev/docs/)
* [wcc](https://github.com/ProjectEvergreen/wcc)
* [Lit SSR](https://lit.dev/docs/ssr/overview/) with plugins for [Eleventy](https://github.com/lit/lit/tree/main/packages/labs/eleventy-plugin-lit#lit-labseleventy-plugin-lit), [Astro](https://docs.astro.build/en/guides/integrations-guide/lit/), and [Rocket](https://rocket.modern-web.dev/docs/basics/components/)

## Installation

Note: if you’re **not** building a plugin or integration for WebC, you can probably skip this section!

It’s available on [npm as `@11ty/webc`](https://www.npmjs.com/package/@11ty/webc):

```
npm install @11ty/webc
```

This is an ESM project and as such requires a `"type": "module"` in your `package.json` (or use the `.mjs` file extension).

```js
import { WebC } from "@11ty/webc";
```

You _can_ use this in a CommonJS file via dynamic import:

```js
(async function() {
	const { WebC } = await import("@11ty/webc");
})();
```

## Examples

### JavaScript API

```js
import { WebC } from "@11ty/webc";

let page = new WebC();

// This enables aggregation of CSS and JS
// As of 0.4.0+ this is disabled by default
page.setBundlerMode(true);

// File
page.setInputPath("page.webc");

// Or, a String
// page.setContent(`<p>Hello!</p>`);

let { html, css, js, components } = await page.compile();

// Or, Readable Streams for each
let { html, css, js } = await page.stream();
```

### It’s HTML

If WebC looks familiar, that’s because WebC *is* HTML. These are single file HTML components but don’t require any special element conventions (for example Vue’s single file component uses a top-level `<template>` for markup). Using `<template>` in a WebC file will output 👀 a `<template>` element.

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<title>WebC Example</title>
	</head>
	<body>
		WebC *is* HTML.
	</body>
</html>
```

* Uses [`parse5`](https://github.com/inikulin/parse5) to parse WebC HTML as modern browsers do (credit to [@DasSurma’s](https://twitter.com/DasSurma/status/1559159122964127744) work with [Vite](https://twitter.com/patak_dev/status/1564265006627176449) here)
* `<!doctype html>` is optional (will be added automatically if the content starts with `<html`).
* Throws a helpful error if it encounters quirks mode markup.

### HTML Imports (kidding… kinda)

To use components, we provide a few options: registering them globally via JavaScript or dynamically declaratively importing directly in your WebC file via `webc:import`.

#### Register global components

```js
import { WebC } from "@11ty/webc";

let page = new WebC();

// Pass in a glob, using the file name as component name
page.defineComponents("components/**.webc");

// Array of file names, using file name as component name
page.defineComponents(["components/my-component.webc"]);

// Object maps component name to file name
page.defineComponents({
	"my-component": "components/my-component.webc"
});
```

And now you can use them in your WebC files without importing!

Consider this `page.webc` file:

```html
<!doctype html>
<title>WebC Example</title>
<my-component></my-component>
```

When compiled, this will expand `<my-component>` to include the contents inside of `components/my-component.webc`.

If the `components/my-component.webc` file contains:

```html
Components don’t need a root element, y’all.
```

Compiling `page.webc` will return the following HTML:

```html
<!doctype html>
<html>
	<head>
		<title>WebC Example</title>
	</head>
<body>
	Components don’t need a root element, y’all.
</body>
</html>
```

Tricky trick: you aren’t limited to custom element names (e.g. `my-component`) here. You can use `p`, `blockquote`, `h1`, or any tag name to remap any HTML element globally. A more useful example might be an `img` component that uses the [Eleventy Image utility](https://www.11ty.dev/docs/plugins/image/) to optimize all images in your project.

#### Dynamic import

See [_`webc:import` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#webcimport)

### Remapping components

See [_`webc:is` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#webcis)

### Component Markup

#### Keep that host component HTML

See [_`webc:keep` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#webckeep)

#### Slots

See [_Slots on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#slots)

### Aggregating CSS and JS

Enabling Bundler Mode (`page.setBundlerMode(true)`) aggregates CSS and JS found in WebC components. Bundler mode is disabled by default (but enabled by default in the Eleventy WebC plugin).

As noted in the JavaScript API section above, the `compile` method returns four different properties:

```js
page.setBundlerMode(true);

let { html, css, js, components } = await page.compile();
```

By default, `<style>` and `<script>` elements in component files are removed from individual component markup and aggregated together for re-use elsewhere (you could write this to a file, or use as Critical CSS in another layout template—the Eleventy plugin will smooth this over for you). _This includes `<link rel="stylesheet">` and `<script src>` when the URLs point to files on the file system ([remote URL sources are not yet supported](https://github.com/11ty/webc/issues/15))_.

Note that if a `<style>` is nested inside of [declarative shadow root](https://web.dev/declarative-shadow-dom/) template (e.g. `<template shadowrootmode>` or the deprecated `<template shadowroot>`), it is also left as is and not aggregated.

You can also opt out of aggregation on a per-element basis using `<style webc:keep>` or `<script webc:keep>`. 

`page.webc`:

```html
<my-component>Default slot</my-component>
```

`components/my-component.webc`:

```html
<style>
my-component {
	color: rebeccapurple;
}
</style>
```

Compilation results:

```js
page.setBundlerMode(true);

let results = await page.compile();

// `results`:
{
	html: "<my-component>Default slot</my-component>",
	css: ["my-component { color: rebeccapurple; }"],
	js: [],
	components: ["page.webc", "components/my-component.webc"]
}
```

The order of aggregated styles and scripts is based on the dependency graph of the components in play (the order is noted in the `components` array, a list of component file names).

#### Scoped CSS

See [_`webc:scoped` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#webcscoped)

### Custom Transforms

You can also transform individual element content using the `setTransform` method.

```js
let component = new WebC();
let md = new MarkdownIt({ html: true });

component.setTransform("md", async (content) => {
	// async-friendly
	return md.render(content);
});
```

Now you can automatically transform markdown in your WebC templates via the `webc:type` attribute.

```html
<template webc:type="md">
# Header
</template>
```

Compiles to:

```html
<h1>Header</h1>
```

* Bonus feature: `webc:type` supports a comma separated list of transforms.

Note that the `<template webc:type>` node is compiled away. If you’d like to keep it around, use `webc:keep` (e.g. `<template webc:type webc:keep>`).

We do provide two built-in transforms in WebC: JavaScript Render Functions (`webc:type="render"`) and CSS scoping (`webc:scoped`). Those are covered in separate sections. You _can_ override these with the `setTransform` API but it is generally recommended to add your own named transform!

### Conditionals

See [_`webc:if` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#webcif)

### Loops

See [_`webc:for` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#webcfor-loops)

### Attributes

See [_Attributes and `webc:root` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#attributes-and-webcroot)

#### Properties (or Props)

See [_Props (properties) on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#props-(properties))

#### Dynamic attributes and properties

See [_Dynamic Attributes and Properties on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#dynamic-attributes-and-properties)

#### Setting multiple attributes

See [_`@attributes` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#@attributes)

### JavaScript Render Functions

See [_`webc:type` (JavaScript Render Functions) on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#webctype-(javascript-render-functions))

### Setting HTML

See [_`@html` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#@html)

### Setting Text

See [_`@text` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#@text)

### Helper Functions

If you want to add custom JavaScript functions for use in render functions, `@html`, or dynamic attributes you can use the `setHelper` method.

```js
import { WebC } from "@11ty/webc";

let page = new WebC();

page.setHelper("alwaysBlue", () => {
	return "Blue"
});
```

And `alwaysBlue()` is now available:

```html
<script webc:type="js">
alwaysBlue()
</script>
```

### Raw Content (no WebC processing)

See [_`webc:raw` on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#webcraw)

## Subtleties and Limitations

See [_Subtleties and Limitations on the WebC Reference_](https://www.11ty.dev/docs/languages/webc/#subtleties-and-limitations)
