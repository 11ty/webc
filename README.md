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
* The `.webc` file extension is recommended (not a requirement)—you _can_ use `.html`.
	* Tip for Visual Studio Code users: go to `Preferences -> Settings -> Files: Associations` to add a mapping for `*.webc` to `html`.

### Integrations/Plugins

* [`@11ty/eleventy-plugin-webc`](https://www.11ty.dev/docs/languages/webc/) adds WebC to [Eleventy](https://www.11ty.dev/)
* [`express-webc`](https://github.com/NickColley/express-webc) by [@NickColley](https://github.com/NickColley/) adds WebC to [Express](https://expressjs.com/)

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

Registering global components is _not_ required! You can use `webc:import` to dynamically import another component inline.

_Important note:_ `webc:` attributes are always removed from the resulting compiled markup.

`page.webc`:

```html
<!doctype html>
<title>WebC Example</title>
<any-tag-name webc:import="components/my-component.webc"></any-tag-name>
```

_Another important note:_ We check for circular component dependencies and throw an error as expected if one is encountered.

New in WebC v0.6.2, you can import directly from an installed npm package. Here’s an example using a WebC component supplied by the [Eleventy Syntax Highlighter plugin](https://www.11ty.dev/docs/plugins/syntaxhighlight/) (`4.2.0` or newer):

```html
<syntax-highlight language="js" webc:import="npm:@11ty/eleventy-plugin-syntaxhighlight">
function myFunction() {
  return true;
}
</syntax-highlight>
```

This uses the component tag name (`syntax-highlight`) to look for a WebC component at `node_modules/@11ty/eleventy-plugin-syntaxhighlight/syntax-highlight.webc` and imports it for use on this node. This works with a tag name override via `webc:is` too.

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

<!--
Slot internal notes

If component content does not exist, render all child content as-is.
If component content does exist, match `<slot>`s to names `slot=""` or default slot content.
Slight deviation from browser web components: If `<slot>` does not match any content, the browser renders as-is. WebC will prune the slot tags from the resulting markup while rendering the fallback content (unless webc:keep is in play).

Slot definitions **must** be top-level (and relatedly cannot be nested)
`<slot>` elements can be nested.
-->

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

_Important note:_ per web component standard conventions, if your component file contains *no content markup* (for example, only `<style>` or `<script>`), `<slot></slot>` is implied and the default slot content will be included automatically. If the WebC component file does contain content markup, the content passed in as the default slot requires `<slot>` to be included.

##### Named slots

This works with named slots too:

`page.webc`:

```html
<my-component>
	This is the default slot.
	<strong slot="named-slot">This is a named slot</strong>
	This is also the default slot.
</my-component>
```

`components/my-component.webc`:

```html
<p><slot name="named-slot"></slot></p>
```

Compiles to:

```html
<p><strong>This is a named slot.</strong></p>
```

If your WebC component wants to _output_ a `<slot>` in the compiled markup for use in clientside JavaScript, use the aforementioned `webc:keep` attribute (e.g. `<slot webc:keep>`).

### Aggregating CSS and JS

Enabling (off-by-default) Bundler Mode (`page.setBundlerMode(true)`) aggregates CSS and JS found in WebC components.

As noted in the JavaScript API section above, the `compile` method returns four different properties:

```js
page.setBundlerMode(true);

let { html, css, js, components } = await page.compile();
```

By default, `<style>` and `<script>` elements in component files are removed from individual component markup and aggregated together for re-use elsewhere (you could write this to a file, or use as Critical CSS in another layout template—the Eleventy plugin will smooth this over for you). _This includes `<link rel="stylesheet">` and `<script src>` when the URLs point to files on the file system ([remote URL sources are not yet supported](https://github.com/11ty/webc/issues/15))_.

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
page.setBundlerMode(true);

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

_(WebC v0.7.1+)_

Use `webc:if` to conditionally render elements. Accepts arbitrary JavaScript (and is async-friendly). Similar to dynamic attributes, this also has access to component attributes and properties.

```html
<div webc:if="true">This will render</div>
<div webc:if="false">This will not render</div>
<div webc:if="myAsyncHelper()">If the helper promise resolves to a truthy value, this will render</div>
```

For more complex conditionals, `webc:type="js"` _(WebC v0.7.1+)_ is recommended (read more below).

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

#### Dynamic attributes

Make any attribute into a dynamic attribute by prefixing it with a `:`. You have access to host component attribute and property names (as well as page data) here!

`page.webc`:

```html
<avatar-image src="my-image.jpeg" alt="Zach is documenting this project"></avatar-image>
```

`components/avatar-image.webc`:

```html
<img :src="src" :alt="alt" class="avatar-image">
```

* In the HTML specification, attribute names are lower-case. When referencing these inside of a dynamic attribute, use the lower-case name (e.g. `<avatar-image mySrc="test">` would be `:src="mysrc"`). See [issue #71 for more discussion](https://github.com/11ty/webc/issues/71).

#### Properties (or Props)

Make any attribute into a prop by prefixing it with `@`. Props are “private” attributes that don’t end up in the output HTML (they are private to WebC). They are identical to attributes except that they are filtered from the output HTML.

`page.webc`:

```html
<avatar-image src="my-image.jpeg" alt="Zach is documenting this project" @secret="This is just between us"></avatar-image>
```

`components/avatar-image.webc`:

```html
<img :has-a-secret="secret ? true : false" :alt="alt" :src="src">
<!-- outputs <img has-a-secret="true" …> -->
```

* In the HTML specification, attribute names are lower-case. When referencing these inside of a dynamic attribute, use the lower-case name (e.g. `<avatar-image @mySrc="test">` would be `:src="mysrc"`). See [issue #71 for more discussion](https://github.com/11ty/webc/issues/71).

### JavaScript Render Functions

You can also transform individual element content using `webc:type`. There are three built-in types:

* `webc:type="js"` which supercedes `webc:type="render"`
* `webc:type="css:scoped"` (internal for `webc:scoped`—overridable!)

JavaScript Render Functions are async friendly (e.g. `async function()`):

#### `webc:type="js"` _(WebC v0.7.1+)_

Run any arbitrary server JavaScript in WebC. Outputs the result of the very last statement executed in the script. Async-friendly (return a promise and we’ll resolve it).

`page.webc`:

```html
<img src="my-image.jpeg" alt="An excited Zach is trying to finish this documentation">
```

`components/img.webc`:

```html
<script webc:type="js">
if(!alt) {
	throw new Error("oh no you didn’t");
}
`<img src="${src}" alt="${alt}">`;
</script>
```

<details>
<summary>Expand to see this example with <code>webc:type="render"</code></summary>

```html
<script webc:type="render">
	function() {
		if(!this.alt) {
			throw new Error("oh no you didn’t");
	}
	// Free idea: use the Eleventy Image plugin to return optimized markup
	return `<img src="${this.src}" alt="${this.alt}">`;
}
</script>
```

</details>

Or use a JavaScript render function to generate some CSS:

`page.webc`:

```html
<add-banner-to-css license="MIT licensed">
/* Some other CSS content */
</add-banner-to-css>
```

`components/add-banner-to-css.webc`:

```html
<script webc:type="js" webc:is="style">`/* ${license} */`</script>
<slot></slot>
```

<details>
<summary>Expand to see this example with <code>webc:type="render"</code></summary>

```html
<script webc:type="render" webc:is="style">
function() {
	return `/* ${this.license} */`;
}
</script>
<slot></slot>
```

</details>

(Yes you can use `<script webc:type="js" webc:scoped>` too).

Here’s another example of a more complex conditional (you can also use `webc:if`!):

```html
<script webc:type="js">
if(alt) {
	`<img src="${src}" alt="${alt}">`
} else {
	`<a href="${src}">Your image didn’t have an alt so you get this link instead.</a>`
}
</script>
```

Note that you have access to the component attributes and properties in the render function (which is covered in another section!).

### Setting HTML

We provide a special `@html` property to override any tag content with custom JavaScript.

```html
<template @html="'Template HTML'"></template>
<template @html="dataProperty"></template>
```

```html
<!-- webc:nokeep will replace the outer element -->
<template @html="'Template HTML'" webc:nokeep></template>
```

* Using `webc:raw` will prevent reprocessing the result as WebC. (v0.6.0+)
* Use `@raw` as an alias for `webc:raw @html` . (v0.7.1+)

### Setting Text

We provide a special `@text` property to override any tag content with custom JavaScript. The entire value returned here will be escaped!

```html
<p @text="dataProperty"></p>

<!-- When dataProperty contains `<p>This is text</p>`, this renders: -->
<p>&lt;p&gt;This is text&lt;/p&gt;</p>
```

```html
<!-- webc:nokeep will replace the outer element -->
<p @text="dataProperty" webc:nokeep></p>
```

### Helper Functions

If you want to add custom JavaScript functions for use in render functions, `@html`, or dynamic attributes you can use the `setHelper` method.

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

Opt out of WebC template processing using `webc:raw`. This works well with `<template>` content. See also the special `@raw` content property _(WebC v0.7.1+)_

```html
<template webc:raw>
Leave me out of this.
<style>
p { color: rebeccapurple; }
</style>
</template>
```

## Subtleties and Limitations

#### Void elements

Custom elements (per specification) are not supported as void elements: they require both a starting and ending tag. You can workaround this limitation using `webc:is`.

### `<head>` Components

There are a few wrinkles when using an HTML parser with custom elements. Notably, the parser tries to force custom element children in the `<head>` over to the `<body>`. To workaround this limitation, use `webc:is`. Here are a few example workarounds:

```html
<head webc:is="my-custom-head">
	<!-- this is slot content, yes you can use named slots here too -->
</head>
```

```html
<head>
	<!-- <my-custom-head> is not allowed here -->
	<meta webc:is="my-custom-head">
	<title webc:is="my-custom-title">Default Title</title>
</head>
```

### Rendering Modes

There are two different rendering modes in Eleventy: `page` and `component`. We attempt to guess the rendering mode that you’d like based on the markup you supply. The `page` rendering mode is for rendering full HTML pages. The `component` rendering mode is for fragments of HTML. Most of the time you won’t need to worry about this distinction but it is included in the documentation for completeness.

* `page` is used when the markup starts with `<!doctype` (or `<!DOCTYPE`) or `<html` (WebC forces no-quirks parsing).
* `component` is used otherwise.