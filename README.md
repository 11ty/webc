# Single file web components

## Features

* Web components compiler, using <my-web-component/> compiles to HTML with defined conventions from web standards.
* Streamable.
* Uses `parse5` to parse HTML with the same rules as browsers
	* https://twitter.com/DasSurma/status/1559159122964127744
	* https://twitter.com/patak_dev/status/1564265006627176449
* Syntax should appear as if baseline webc component does not require compilation (but components _are_ compiled).

### HTML

* Single file components just use HTML in the thing, no `<template>` required (a la Svelte, not Vue).
* Using a raw `<template>` has no special behavior, it outputs a `<template>`!
* Maps `[slot]` (attribute) sources to `<slot>` elements in components (as expected)
	* Use `[slot][webc:raw]` to opt-out and keep a slot for use in a clientside component.
* HTML-only components:
	* Parent component tags are excluded from client output for HTML-only components (components without any CSS, JS, or declarative shadow root templates)
	* Keep the parent component tag by adding the `webc:keep` attribute
* Use `webc:is` attribute for component redefinition
* Handles circular dependencies (You can’t use `<web-component>` inside of shadow dom for `<web-component>`)
* Use `<template webc:type>` for processing content via JS, Liquid, Nunjucks or other custom language extensions.
	* Operates in outerHTML-mode (replaces the parent `<template>`) unless `<template webc:keep>` in use.
* Use `<* webc:root>` to merge attributes with the outer tag (e.g. merging `class` or `style` attributes via a component definition)
* Use `<div :name="lookupKey">` to do a lookup on component argument data
* Use `<div @name="my argument value">` to pass in a prop without adding an argument.

### CSS

* Use `<style>` for CSS
* Use one or more `<style>` nodes.
* Styles are extracted from component definition and rolled up (in correct dependency-graph order) for re-use.
	* Use `webc:keep` to opt-out of aggregation for a single `<style>`
* Use `<style webc:type>` for processing via Sass or other custom language extensions.
* Use `<style webc:scoped>` to add a hash class prefix to the start of each selector for scoping. Hashes are calculated based on the CSS content of the component.
	* Or, use `<style webc:scoped="my-prefix">` to specify your own prefix (we’ll throw an error if you duplicate one already in use in this component tree)

### Script

* Use `<script webc:type>` for processing via typescript or other custom langauge extensions.
* JavaScript is extracted from component definition and rolled up (in correct dependency-graph order) for re-use.
	* Use `webc:keep` to opt-out of aggregation for a single `<script>`

## Editor tips

* In VS Code, use `Files: Associations` to add a mapping for `*.webc` to `html`.
