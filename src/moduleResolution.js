import { TemplatePath } from "@11ty/eleventy-utils";
import path from "path";
import { Path } from "./path.js";

class ModuleResolution {
	constructor(aliases) {
		this.setAliases(aliases);
	}

	static REGEX = {
		startsWithAlias: /^([^\:]+)\:/i
	};

	setAliases(aliases = {}) {
		// TODO project root alias?
		this.aliases = Object.assign({
			"npm": "./node_modules/"
		}, aliases);
	}

	setTagName(tagName) {
		this.tagName = tagName;
	}

	checkLocalPath(resolvedPath) {
		let projectDir = TemplatePath.getWorkingDir();
		let modulePath = TemplatePath.absolutePath(projectDir, resolvedPath);

		// No references outside of the project are allowed
		if (!modulePath.startsWith(projectDir)) {
			throw new Error("Invalid import reference (must be in the project root), received: " + resolvedPath );
		}
	}

	hasValidAlias(fullPath) {
		let starts = Object.keys(this.aliases);
		for(let start of starts) {
			if(fullPath.startsWith(`${start}:`)) {
				return true;
			}
		}
		return false;
	}

	static getAlias(fullPath) {
		let match = fullPath.match(ModuleResolution.REGEX.startsWithAlias);
		if(match && match[1]) {
			return match[1];
		}
		return undefined;
	}

	resolveAliases(fullPath) {
		let alias = ModuleResolution.getAlias(fullPath);

		// unaliased, relative from component path
		if(!alias) {
			return Path.normalizePath(fullPath);
		} else if(!this.aliases[alias]) {
			throw new Error(`Invalid WebC aliased import path, requested: ${fullPath} (known aliases: ${Object.keys(this.aliases).join(", ")})`);
		}

		// aliases, are relative from project root
		let unprefixedPath = fullPath.slice(alias.length + 1);
		return Path.normalizePath(path.join(this.aliases[alias], unprefixedPath));
	}

	// npm:@11ty/eleventy is supported when tag name is supplied by WebC (returns `node_modules/@11ty/eleventy/tagName.webc`)
	// npm:@11ty/eleventy/folderName deep folder name is not supported
	// npm:@11ty/eleventy/module.webc direct reference is supported (with deep folder names too)
	resolve(fullPath) {
		// resolve aliases first
		let resolvedPath = this.resolveAliases(fullPath);

		// make sure file is local to the project
		this.checkLocalPath(resolvedPath);

		// direct link to a webc file
		if(resolvedPath.endsWith(".webc")) {
			return resolvedPath;
		}

		if(this.tagName) {
			// Add the tagName and webc suffix
			return `${resolvedPath}/${this.tagName}.webc`
		}

		return resolvedPath;
	}
}

export { ModuleResolution };
