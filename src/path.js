import path from "path";
import { TemplatePath } from "@11ty/eleventy-utils";

class Path {
	// cross browser normalize a file path to use /
	static normalizePath(filePath) {
		if(typeof filePath === "string") {
			return TemplatePath.addLeadingDotSlash(filePath.split(path.sep).join("/"));
		}
		return filePath;
	}
}

export { Path };