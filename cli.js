#!/usr/bin/env node

import { input } from "@inquirer/prompts";
import fs from "node:fs/promises";
import os from "node:os";
import process from "node:process";
import { dirname, join, resolve } from "node:path";
import { execa } from "execa";
import { parseArgs } from "node:util";
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const zipOutputPath = join(process.cwd(), "game.zip");

const { values } = parseArgs({
	options: {
		plugin: {
			type: "string",
			short: "p",
		},
		url: {
			type: "string",
			short: "u",
		},
		"adlad-version": {
			type: "string",
			short: "v",
		},
		"query-string-key": {
			type: "string",
			short: "q",
		},
	},
});

let pluginString = values.plugin || "";
let urlString = values.url || "";
let adladVersionString = values["adlad-version"] || "";
let queryStringKey = values["query-string-key"] || "";
try {
	while (!pluginString) {
		pluginString = await input({
			message: "Enter the name of the plugin for the portal where you plan on uploading the zip.\n",
		});
	}
	while (!urlString) {
		urlString = await input({
			message:
				"Enter the url where your game is hosted excluding any /?adlad parameters.\nThe protocol may be omitted and defaults to https.\n",
		});
	}
	if (!adladVersionString) {
		adladVersionString = await input({
			message: "Enter the adlad version you'd like to use (defaults to latest).\n",
		}) || "latest";
	}
	if (!queryStringKey) {
		queryStringKey = await input({
			message:
				"If you changed the `pluginSelectQueryStringKey` in the new AdLad() options, enter the same value here.\nYou can leave this blank otherwise.\n",
		}) || "adlad";
	}
} catch (error) {
	if (error instanceof Error && error.name == "ExitPromptError") {
		process.exit(1);
	} else {
		throw error;
	}
}

/** @type {string} */
let pluginSpecifier;
if (pluginString.startsWith("@") || pluginString.startsWith("http:") || pluginString.startsWith("https:")) {
	pluginSpecifier = pluginString;
} else {
	pluginSpecifier = `@adlad/plugin-${pluginString}`;
}

const prefix = join(os.tmpdir(), "adlad-iframe-build-");
const tempDir = await fs.mkdtemp(prefix);

const builderDir = dirname(fileURLToPath(import.meta.url));

if (!urlString.startsWith("http:") && !urlString.startsWith("https:")) {
	urlString = "https://" + urlString;
}
const url = new URL(urlString);
url.searchParams.set(queryStringKey, "iframe-bridge");

try {
	await buildIframe(tempDir);
} finally {
	await fs.rm(tempDir, { recursive: true, force: true });
}

/**
 * @param {string} tempDir
 */
async function buildIframe(tempDir) {
	console.log("Fetching dependencies...");
	const packageJsonPath = join(tempDir, "package.json");
	await fs.writeFile(packageJsonPath, "{}");

	await execa("npm", ["install", pluginSpecifier], { cwd: tempDir });

	// We need to figure out the name of the plugin that was just installed.
	// We do this by locking at the package.json contents, there should only be a single dependency at this point.
	// Using this method allows users to provide a tarball or github url as plugin.
	const packageJsonContents = await fs.readFile(packageJsonPath, "utf-8");
	const packageJson = JSON.parse(packageJsonContents);

	const dependencies = Object.entries(packageJson.dependencies);
	if (dependencies.length != 1) {
		throw new Error("Expected exactly one package to be installed");
	}
	const resolvedPluginSpecifier = dependencies[0][0];

	await execa("npm", ["install", `@adlad/adlad@${adladVersionString}`], { cwd: tempDir });

	const rendaPath = require.resolve("renda/package.json");
	const nodePath = resolve(rendaPath, "../..");
	const tempNodePath = join(tempDir, "node_modules");
	const srcEntryPointPath = join(builderDir, "entry.js");
	const modifiedEntryPointPath = join(tempDir, "entry.js");
	let entryPoint = await fs.readFile(srcEntryPointPath, "utf-8");
	entryPoint = entryPoint.replaceAll(
		`import plugin from "@adlad/plugin-dummy";`,
		`import plugin from "${resolvedPluginSpecifier}";`,
	);
	entryPoint = entryPoint.replaceAll(`iframe.src = "https://example.com";`, `iframe.src = "${url.href}";`);
	await fs.writeFile(modifiedEntryPointPath, entryPoint);

	console.log("Building...");
	const { outputFiles: jsOutputFiles } = await esbuild.build({
		entryPoints: [modifiedEntryPointPath],
		bundle: true,
		write: false,
		format: "iife",
		platform: "browser",
		minify: true,
		nodePaths: [nodePath, tempNodePath],
	});
	if (jsOutputFiles.length != 1) {
		throw new Error("Expected there to be exactly one output file");
	}
	const [jsOutputFile] = jsOutputFiles;

	const indexHtmlPath = join(builderDir, "index.html");
	let indexHtml = await fs.readFile(indexHtmlPath, "utf-8");
	indexHtml = indexHtml.replaceAll(`<!-- script -->`, `<script>${jsOutputFile.text}</script>`);

	const zip = new JSZip();
	zip.file("index.html", indexHtml);
	const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
	await fs.writeFile(zipOutputPath, zipBuffer);
	console.log(`Done! Created ${zipOutputPath}`);
}
