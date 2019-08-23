require("file-loader?name=[name].[ext]!html-minify-loader!./index.html");

const debug = require("debug");
const log = debug("place-live");

const screen = document.getElementById("screen");
screen.style.height = window.innerHeight + "px";
screen.style.width = (480 / 854) * window.innerHeight + "px";

const liveIndicator = document.getElementById("live");

let baseSettings = {
	colors: {
		/* eslint-disable sort-keys */
		white: "#FFFFFF",
		gray: "#E4E4E4",
		darkgray: "#888888",
		black: "#222222",
		pink: "#FFA7D1",
		red: "#E50000",
		orange: "#E59500",
		brown: "#A06A42",
		yellow: "#E5D900",
		lime: "#94E044",
		green: "#02BE01",
		teal: "#00D3DD",
		skyblue: "#0083C7",
		blue: "#0000EA",
		lavender: "#CF6EE4",
		purple: "#820080",
		/* eslint-enable sort-keys */
	},
	height: 120,
	width: 120,
	streamID: "",
};
try {
	baseSettings = Object.assign(baseSettings, JSON.parse(localStorage.getItem("place-live:settings")));
} catch (error) {
	log("Saved settings has invalid JSON, reverting to defaults:", error);
}

const settings = new Proxy(baseSettings, {
	set: (target, ...rest) => {
		const result = Reflect.set(target, ...rest);
		localStorage.setItem("place-live:settings", JSON.stringify(target));
		return result;
	},
});

const board = document.getElementById("board");
board.style.height = board.clientWidth + "px";

board.height = document.getElementById("boardHeight").innerText = settings.height;
board.width = document.getElementById("boardWidth").innerText = settings.width;

const settingsInput = document.getElementById("settings");
settingsInput.value = JSON.stringify(settings, null, "\t");
settingsInput.addEventListener("input", event => {
	let newValue = {};
	try {
		newValue = JSON.parse(event.target.value);
	} catch (error) {
		return log("Invalid JSON in settings input: ", error);
	}

	for (const key of Object.keys(newValue)) {
		settings[key] = newValue[key];
	}
});

const ctx = board.getContext("2d");

const boardData = localStorage.getItem("place-live:board") || "";
if (boardData) {
	const image = new Image();
	image.addEventListener("load", () => {
		ctx.drawImage(image, 0, 0);
	});
	image.src = boardData;
}

/**
 * Saves the board data to local storage.
 * @param {HTMLCanvasElement} canvas The canvas to save the data of.
 * @param {string} key The local storage key to use.
 */
function saveBoardData(canvas = board, key = "place-live:board") {
	localStorage.setItem(key, canvas.toDataURL());
}

/**
 * Places a pixel at a position on the board.
 * @param {number} x The X position to place the pixel at.
 * @param {number} y The Y position to place the pixel at.
 * @param {string} color The color of the pixel.
 */
function placePixel(x, y, color) {
	ctx.fillStyle = color;
	ctx.fillRect(x, y, 1, 1);

	saveBoardData();
}

/**
 * Gets the current time as a string.
 * @returns {string} The current time separated by colons.
 */
function time() {
	const now = new Date();

	const hours = now.getHours().toString().padStart(2);
	const minutes = now.getMinutes().toString().padStart(2, "0");
	const seconds = now.getSeconds().toString().padStart(2, "0");

	return `${hours}:${minutes}:${seconds}`;
}

const logElem = document.getElementById("log");
/**
 * Adds a line to the log.
 * @param {string} entry The text to add to the log.
 */
function addToLog(entry) {
	const lastEntries = logElem.innerText.split("\n").slice(-4);
	lastEntries.push(`[${time()}] ${entry}`);
	log("Added '%s' to public log", entry);
	logElem.innerText = lastEntries.join("\n");
}
addToLog("We're live!");

if (typeof settings.colors === "object") {
	const colors = document.getElementById("colors");
	const entries = Array.isArray(settings.colors) ? settings.colors.map(color => [color, color]) : Object.entries(settings.colors);

	entries.forEach(([name, color]) => {
		const colorSpan = document.createElement("span");

		colorSpan.innerText = name;
		colorSpan.style.color = color;

		colors.append(colorSpan);
	});
}

async function getSocket() {
	if (settings.commentSocketURL) {
		return new WebSocket(settings.commentSocketURL);
	}
	if (!settings.streamID) return;

	const postDetails = await fetch(`https://gateway.reddit.com/desktopapi/v1/postcomments/${settings.streamID}?limit=1&truncate=0`).then(res => res.json());
	if (postDetails && postDetails.posts && postDetails.posts["t3_" + settings.streamID]) {
		const post = postDetails.posts["t3_" + settings.streamID];
		const socketUrl = post.liveCommentsWebsocket;
		return new WebSocket(socketUrl);
	}
}
getSocket().then(socket => {
	if (!(socket instanceof WebSocket)) {
		return log("Could not fetch comments websocket");
	}

	socket.addEventListener("open", () => {
		liveIndicator.classList.add("socket-connected");
		log("Socket opened!");
	});
	socket.addEventListener("close", () => {
		liveIndicator.classList.remove("socket-connected");
	});
	socket.addEventListener("message", event => {
		let data = {};
		try {
			data = JSON.parse(event.data);
		} catch (error) {
			return log("Socket message data could not be parsed");
		}

		if (data.type !== "new_comment") return;

		const content = data.payload.body.toLowerCase().match(/(\d+) (\d+) ([a-z]+)/);
		if (content === null) {
			if (Array.isArray(settings.importantUsers) && settings.importantUsers.includes(data.payload.author)) {
				addToLog(`u/${data.payload.author} said: ${data.payload.body}`);
			} else {
				return;
			}
		}

		const xPos = parseInt(content[1]);
		const yPos = parseInt(content[2]);
		if (!Number.isSafeInteger(xPos) || !Number.isSafeInteger(yPos)) return;
		if (xPos < 0 || yPos < 0 || xPos >= board.width || yPos >= board.height) return;

		if (typeof settings.colors !== "object") return;

		if (Array.isArray(settings.colors)) {
			if (!settings.colors.includes(content[3])) return;
			placePixel(xPos, yPos, content[3]);
		} else if (typeof settings.colors === "object") {
			if (!settings.colors[content[3]]) return;
			placePixel(xPos, yPos, settings.colors[content[3]]);
		}
		addToLog(`u/${data.payload.author} placed ${content[3]} pixel at (${xPos}, ${yPos})`);
	});
});

if (settings.streamID) {
	const streamURL = document.getElementById("streamURL");
	streamURL.value = `https://www.reddit.com/rpan/${settings.streamID}`;
}