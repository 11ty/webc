import fs from "fs";
import path from "path";

class FileSystemCache {
	constructor() {
		this.contents = {};
	}

	isFullUrl(filePath) {
		try {
			new URL(filePath);
			return true;
		} catch(e) {
			return false;
		}
	}

	static getRelativeFilePath(filePath, relativeTo) {
		if(relativeTo) {
			let parsed = path.parse(relativeTo);
			return path.join(parsed.dir, filePath);
		}
		return filePath;
	}

	isFileInProjectDirectory(filePath) {
		let workingDir = path.resolve();
		let absoluteFile = path.resolve(filePath);
		return absoluteFile.startsWith(workingDir);
	}

	read(filePath, relativeTo) {
		if(this.isFullUrl(filePath)) {
			throw new Error(`Full URLs in <script> and <link rel="stylesheet"> are not yet supported without webc:keep.`);
		}

		filePath = FileSystemCache.getRelativeFilePath(filePath, relativeTo);

		if(!this.isFileInProjectDirectory(filePath)) {
			throw new Error(`Invalid path ${filePath} is not in the working directory.`);
		}

		if(!this.contents[filePath]) {
			this.contents[filePath] = fs.readFileSync(filePath, {
				encoding: "utf8"
			});
		}

		return this.contents[filePath];
	}
}

export { FileSystemCache };
