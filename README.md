# WebC is for Single File Web Components

## Features

* Framework-independent standalone HTML serializer for generating markup for Web Components.
	* Expand any HTML element (including custom elements and web components) to HTML with defined conventions from web standards.
* Compilation tools to aggregate component-level assets (CSS or JS) for critical CSS or client JavaScript.
* Opt-in to scope your component CSS using WebC’s built-in CSS prefixer.
	* Or, use browser-native Shadow DOM style scoping (requires Declarative Shadow DOM browser support for proper Progressive Enhancement)
* Progress-enhancement friendly. 
* Streaming friendly.
* Shadow DOM friendly.
* Async friendly.
* The `.webc` file extension is recommended (not a requirement)—you _can_ use `.html`.
	* Tip for Visual Studio Code users: go to `Preferences -> Settings -> Files: Associations` to add a mapping for `*.webc` to `html`.

## Installation

It’s available [on npm as `@11ty/webc`](https://www.npmjs.com/package/@11ty/webc):

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

// File
page.setInputPath("page.webc");

// Or, a String
// page.setContent(`<p>Hello!</p>`);

let { html, css, js, components } = await page.compile();

// Or, Readable Streams for each
let { html, css, js } = await page.stream();
```

### It’s HTML

If this looks familiar, that’s because WebC *is* HTML. These are single file HTML components but don’t require any special element conventions (for example Vue’s single file component uses a top-level `<template>` for markup). Using `<template>` in a WebC file will output 👀 a `<template>` element.

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

* Uses [`parse5`](https://github.com/inikulin/parse5) to parse HTML as modern browsers do (credit to [@DasSurma’s](https://twitter.com/DasSurma/status/1559159122964127744) work with [Vite](https://twitter.com/patak_dev/status/1564265006627176449) here)
* `<!doctype html>` is optional (added if omitted).
* Throws a helpful error if encounters quirks mode markup.

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

Registering global components is _not_ required! You can use `webc:import` to dynamically import another component inline.

_Important note: `webc:` attributes are always removed from the resulting compiled markup._

`page.webc`:

```html
<title>WebC Example</title>
<any-tag-name webc:import="components/my-component.webc"></any-tag-name>
```

Note: We check for circular component dependencies and throw an error as expected if one is encountered.

### Remapping components

Use `webc:is` to remap a component to something else!

```html
<div webc:is="my-component"></div>

<!-- equivalent to -->
<my-component></my-component>
```

### Component Markup

#### Keep that host component HTML

All of the examples we’ve used so far were HTML-only components. You’ll note that when a component is HTML-only, it replaces the host component with the component content (`<my-component>` was left out of the output).

If you’d like to keep the host component element around, use `webc:keep`:

```html
<my-component webc:keep></my-component>
```

Compiles to:

```html
<my-component>Components don’t need a root element, y’all.</my-component>
```

Adding a `<style>` or `<script>` element to your component file will automatically keep the host component tag around too (for styling or scripting purposes). You can opt-out of this using `webc:nokeep`.

#### Slots

Child content optionally precompiles using `<slot>` and `[slot]` too.

`page.webc`:

```html
<my-component>This is the default slot</my-component>
```

`components/my-component.webc`:

```html
<p><slot></slot></p>
```

Compiles to:

```html
<p>This is the default slot.</p>
```

Important note: if your component file contains *no content markup* (for example, only `<style>` or `<script>`), the default slot will be used automatically. If the WebC component file does contain content markup, the content passed in as the default slot will require `<slot>` to be included.

##### Named slots

This works with named slots too:

`page.webc`:

```html
<my-component>
	<div slot="named-slot">This is a named slot</div>
</my-component>
```

`components/my-component.webc`:

```html
<p><slot name="named-slot"></slot></p>
```

Compiles to:

```html
<p>This is a named slot.</p>
```

If your WebC component wants to _output_ a `<slot>` in the compiled markup for use in clientside JavaScript, use the aforementioned `webc:keep` attribute (e.g. `<slot webc:keep>`).

### Aggregating CSS and JS

As noted in the JavaScript API section above, the `compile` method returns four different properties:

```js
let { html, css, js, components } = await page.compile();
```

By default, `<style>` and `<script>` elements in component files are removed from individual component markup and aggregated together for re-use elsewhere (you could write this to a file, or use as Critical CSS in another layout template—the Eleventy plugin will smooth this over for you).

Note that if a `<style>` is nested inside of [declarative shadow root](https://web.dev/declarative-shadow-dom/) template (e.g. `<template shadowroot>`), it is also left as is and not aggregated.

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

We include a lightweight mechanism (`webc:scoped`) to scope component CSS. Selectors will be prefixed with a new component class name hash key based on the style content. If you use `:host` here it will be replaced with the class selector.

`page.webc`:

```html
<my-component>Default slot</my-component>
```

`components/my-component.webc`:

```html
<style webc:scoped>
:host {
	color: blue;
}
:host:defined {
	color: rebeccapurple;
}
</style>
```

Compilation results:

```js
let results = await page.compile();

// `results` (js and components omitted):
{
	html: "<my-component class=\"wcl2xedjk\">Default slot</my-component>",
	css: [".wcl2xedjk{color:blue}.wcl2xedjk:defined{color:rebeccapurple}"],
}
```

You can also specify an attribute value to `webc:scoped` to hard code your own component prefix (e.g. `<style webc:scoped="my-prefix">`). This allows the CSS to look a bit more friendly and readable. We will automatically check for duplicate values in your component tree and throw an error if collisions occur.

Note: Some folks recommend using Declarative Shadow DOM (the fastest and safest way to do component style encapsulation), however (in my personal opinion) the JavaScript progressive enhancement story there requires ubiquitous browser support before using it for content in the critical rendering path (so just be aware). You can use both methods in WebC!

### Custom Transforms

You can also transform individual element content using the `setTransform` method.

```js
let component = new WebC();
let md = new MarkdownIt({ html: true });

component.setTransform("md", (content) => {
	return md.render(content);
});
```

Now you can automatically transform markdown in your WebC templates via the `webc:type` attribute:

```html
<template webc:type="md">
# Header
</template>
```

Compiles to:

```html
<h1>Header</h1>
```

Note that `<template webc:type>` is compiled away. Again, if you’d like to keep it around, use `webc:keep` (e.g. `<template webc:type webc:keep>`).

We do provide two built-in transforms in WebC: JavaScript Render Functions (`webc:type="render"`) and CSS scoping (`webc:scoped`). Those are covered in separate sections. You _can_ override these with the `setTransform` API but it is generally recommended to add your own named transform!

### Attributes

Consider this example:

`page.webc`:

```html
<my-component class="sr-only">This is the default slot</my-component>
```

Inside of your component definition, you can add attributes to the host component using `webc:root`

`components/my-component.webc`:

```html
<template webc:root class="another-class">
	Some component content
</template>
```

* `class` and `style` attributes are merged as expected.

#### Lookup attributes

Make any attribute into a lookup attributes by prefixing it with a `:`. You have access to host component attribute and property names (as well as page data) here!

`page.webc`:

```html
<avatar-image src="my-image.jpeg" alt="Zach is documenting this project"></avatar-image>
```

`components/avatar-image.webc`:

```html
<img :src="src" :alt="alt" class="avatar-image">
```

Lookup attributes can accept any [Lodash compatible path selector](https://lodash.com/docs/#get) (for more complex nested data).

#### Properties

Properties are pretend-attributes that will not be rendered in the resulting markup. Prefix the attribute name with `@` to make it a property.

`page.webc`:

```html
<avatar-image src="my-image.jpeg" alt="Zach is documenting this project" @secret="This is just between us"></avatar-image>
```

### JavaScript Render Functions

You can also transform individual element content using `webc:type`. We provide one built-in type, `render` for JavaScript render functions. These are async friendly (e.g. `async function()`):

`page.webc`:

```html
<img src="my-image.jpeg" alt="An excited Zach is trying to finish this documentation">
```

`components/img.webc`:

```html
<script webc:type="render" webc:is="template">
function() {
	if(!this.alt) {
		throw new Error("oh no you didn’t");
	}
	// Free idea: use the Eleventy Image plugin to return optimized markup
	return `<img src="${this.src}" alt="${this.alt}">`;
}
</script>
```

Or use a JavaScript render function to generate some CSS:

`page.webc`:

```html
<add-banner-to-css license="MIT licensed">
/* Some other CSS content */
</add-banner-to-css>
```

`components/add-banner-to-css.webc`:

```html
<script webc:type="render" webc:is="style">
function() {
	return `/* ${this.license} */`;
}
</script>
<slot></slot>
```

(Yes you can use `<script webc:type="render" webc:scoped>` here too).

Note that you have access to the component attributes and properties in the render function (which is covered in another section!).

#### Setting HTML

We provide a special `@html` property to override any tag content with custom JavaScript.

```html
<template @html="'Template HTML'"></template>
<template @html="this.dataProperty"></template>

<!-- webc:nokeep will replace the outer html -->
<template @html="'Template HTML'" webc:nokeep></template>
```

#### Helper Functions

If you want to add custom JavaScript functions for use in render functions or `@html`, you can use the `setHelper` method.

```js
import { WebC } from "@11ty/webc";

let page = new WebC();

page.setHelper("alwaysBlue", () => {
	return "Blue"
});
```

And `this.alwaysBlue()` is now available:

```html
<script webc:type="render" webc:is="template">
function() {
	return this.alwaysBlue();
}
</script>
```

### Raw Content (no WebC processing)

Opt out of WebC template processing using `webc:raw`. This works well with `<template>` content.

```html
<template webc:raw>
Leave me out of this.
<style>
p { color: rebeccapurple; }
</style>
</template>
```
