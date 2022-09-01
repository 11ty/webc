# Single file web components

## Requirements

* Web components compiler, using <my-web-component/> compiles to HTML with defined conventions from web standards.
* Streamable.
* Parse with the same rules as browsers
	* https://twitter.com/DasSurma/status/1559159122964127744
	* https://twitter.com/patak_dev/status/1564265006627176449
* Syntax should appear as if baseline webc component does not require compilation (but components _are_ compiled).
* HTML
	* Just put the HTML in the thing, no `<template>` required (a la Svelte, not Vue).
	* Using raw `<template>` has no special behavior, it outputs a `<template>`.
	* Use `<template webc:type>` to replace itself with the output from any custom external template syntax engine (async-friendly)
	* Use `<template webc:type webc:keep>` to replace just the child content (not itself)
	* Apply `[slot]` (attribute) sources to `<slot>` elements in components.
		* Use `[slot][webc:raw]` to opt-out and keep a slot for clientside use.
	* Component tags are excluded from client output for HTML-only components (no CSS or JS)
		* Opt out with `webc:keep` attribute
		* If component contains `<style>` or `<script>`, tag *is* included (for client component behavior/styling)
	* Server components can be used on the client
	* Allow using `webc:is` attribute for component redefinition
	* Handle circular dependencies (can’t use `<web-component>` inside of shadow dom for `<web-component>`)
	* Use `<template webc:root>` to merge attributes with the outer tag (e.g. adding `class` entries via a child component)
* CSS
	* Use `<style>` for CSS
	* Use one or more CSS nodes.
	* Styles are extracted from component definition and rolled up for re-use.
	* Use `<style webc:scoped>` to add a hash class prefix to the start of each selector for scoping. Hashes are calculated based on the CSS content of the component.
		* Use `<style webc:scoped="my-prefix">` to specify your own prefix (we’ll throw an error if you duplicate one already in use in this component tree)

## Tips

Use `Files: Associations` to add a mapping for `*.webc` to `html`.
