import { AdLad } from "@adlad/adlad";
import { TypedMessenger } from "renda";
import plugin from "@adlad/plugin-dummy";

/** @type {AdLad?} */
let adLad = null;

const messenger = new TypedMessenger();
globalThis.addEventListener("message", (event) => {
	if (typeof event.data == "object" && event.data && "adLadIframeBridgeMessage" in event.data) {
		messenger.handleReceivedMessage(event.data.adLadIframeBridgeMessage);
	}
});

const pluginOptions = undefined;

messenger.setResponseHandlers({
	async init() {
		adLad = new AdLad({
			plugins: [plugin(pluginOptions)],
		});
		adLad.onNeedsMuteChange((needsMute) => {
			messenger.send.setNeedsMute(needsMute);
		});
		adLad.onNeedsPauseChange((needsPause) => {
			messenger.send.setNeedsPause(needsPause);
		});
		return { success: true };
	},
	showFullScreenAd: async () => {
		return await adLad.showFullScreenAd();
	},
	gameplayStart: async () => {
		return await adLad.gameplayStart();
	},
	getActivePlugin: () => {
		return adLad.activePlugin;
	},
	/**
	 * @param {string} command
	 * @param {unknown[]} args
	 */
	customRequest: (command, args) => {
		return adLad.customRequests[command](...args);
	},
	/**
	 * @param {string} key
	 * @param {unknown} value
	 */
	setStorageItem: async (key, value) => {
		console.log("setStorageItem response handler called", { key, value });
		return await adLad.setStorageItem(key, value);
	},
	/**
	 * @param {string} key
	 * @returns {Promise<unknown>}
	 */
	getStorageItem: async (key) => {
		console.log("getStorageItem response handler called", { key });
		return await adLad.getStorageItem(key);
	},
});

window.addEventListener("load", () => {
	const iframe = document.createElement("iframe");
	iframe.allow =
		"autoplay; fullscreen; camera; gamepad; keyboard-map; xr-spatial-tracking; clipboard-write; web-share; accelerometer; magnetometer; gyroscope; microphone";
	document.body.append(iframe);

	messenger.setSendHandler((data) => {
		iframe.contentWindow.postMessage({ adLadIframeBridgeMessage: data.sendData }, "*", data.transfer);
	});

	iframe.src = "https://example.com";
});
