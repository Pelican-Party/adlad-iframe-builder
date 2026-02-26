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
messenger.setResponseHandlers({
	async init() {
		adLad = new AdLad({
			plugins: [plugin()],
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
