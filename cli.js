#!/usr/bin/env node

import { input } from "@inquirer/prompts";
import fs from "node:fs/promises";
import os from "node:os";
import process from "node:process";
import { dirname, join } from "node:path";
import { execa } from "execa";
import { parseArgs } from "node:util";
import esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

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
		version: {
			type: "string",
			short: "v",
		},
		queryStringKey: {
			type: "string",
			short: "q",
		},
	},
});

let pluginString = values.plugin || "";
let urlString = values.url || "";
let adladVersionString = values.version || "";
let queryStringKey = values.queryStringKey || "";
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

let pluginSpecifier;
if (pluginString.startsWith("@")) {
	pluginSpecifier = pluginString;
} else {
	pluginSpecifier = `@adlad/plugin-${pluginString}`;
}

let pluginSpecifierWithoutVersion;
const lastAtIndex = pluginSpecifier.lastIndexOf("@");
if (lastAtIndex > 0) {
	pluginSpecifierWithoutVersion = pluginSpecifier.slice(0, lastAtIndex);
} else {
	pluginSpecifierWithoutVersion = pluginSpecifier;
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
	await fs.writeFile(join(tempDir, "package.json"), "{}");
	await execa("npm", ["install", `@adlad/adlad@${adladVersionString}`], { cwd: tempDir });
	await execa("npm", ["install", pluginSpecifier], { cwd: tempDir });

	const nodePath = join(builderDir, "node_modules");
	const tempNodePath = join(tempDir, "node_modules");
	const srcEntryPointPath = join(builderDir, "entry.js");
	const modifiedEntryPointPath = join(tempDir, "entry.js");
	let entryPoint = await fs.readFile(srcEntryPointPath, "utf-8");
	entryPoint = entryPoint.replaceAll(
		`import plugin from "@adlad/plugin-dummy";`,
		`import plugin from "${pluginSpecifierWithoutVersion}";`,
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
