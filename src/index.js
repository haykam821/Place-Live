require("file-loader?name=[name].[ext]!html-minify-loader!./index.html");

const { main: log } = require("./debug.js");

const screen = document.getElementById("screen");
screen.style.height = window.innerHeight + "px";
screen.style.width = (480 / 854) * window.innerHeight + "px";

const liveIndicator = document.getElementById("live");

const settings = require("./settings.js");

const board = document.getElementById("board");
board.style.height = board.clientWidth + "px";

function setBoardProperty(property, id, value) {
	board[property] = value;
	document.getElementById(id).innerText = value;
}
setBoardProperty("height", "boardHeight", settings.height);
setBoardProperty("width", "boardWidth", settings.width);

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

// Log download functionality
const saveLog = document.getElementById("saveLog");
saveLog.addEventListener("click", () => {
	const link = document.createElement("a");
	link.href = "data:text/plain;charset=utf-8," + encodeURIComponent(logElem.innerText.trim());
	link.download = "place-live-log.txt";
	link.style.display = "none";

	// Trigger click in DOM temporarily
	document.body.append(link);
	link.click();
	link.remove();
});

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

/**
 * Attempts to place a pixel.
 * @param {number} xPos The X position of the pixel to place.
 * @param {number} yPos The Y position of the pixel to place.
 * @param {string} color The color of the pixel to place.
 * @param {string} author The pixel placement's author.
 */
function attemptPlace(xPos, yPos, color, author) {
	if (!Number.isSafeInteger(xPos) || !Number.isSafeInteger(yPos)) return;
	if (xPos < 0 || yPos < 0 || xPos >= board.width || yPos >= board.height) return;

	if (typeof settings.colors !== "object") return;

	if (Array.isArray(settings.colors)) {
		if (!settings.colors.includes(color)) return;
		placePixel(xPos, yPos, color);
	} else if (typeof settings.colors === "object") {
		if (!settings.colors[color]) return;
		placePixel(xPos, yPos, settings.colors[color]);
	}
	addToLog(`u/${author} placed ${color} pixel at (${xPos}, ${yPos})`);
}

/**
 * Gets the live comments socket for the configured post.
 */
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

async function start() {
	const socket = await getSocket();

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
		attemptPlace(xPos, yPos, content[3], data.payload.author);
	});
}
/* eslint-disable-next-line unicorn/prefer-top-level-await */
start();

if (settings.streamID) {
	const streamURL = document.getElementById("streamURL");
	streamURL.value = `https://www.reddit.com/rpan/${settings.streamID}`;
}
