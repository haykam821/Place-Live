const screen = document.getElementById("screen");
screen.style.height = window.innerHeight + "px";
screen.style.width = (480 / 854) * window.innerHeight + "px";

let baseSettings = {
	width: 120,
	height: 120,
	colors: {
		"white": "#FFFFFF",
		"gray": "#E4E4E4",
		"darkgray": "#888888",
		"black": "#222222",
		"pink": "#FFA7D1",
		"red": "#E50000",
		"orange": "#E59500",
		"brown": "#A06A42",
		"yellow": "#E5D900",
		"lime": "#94E044",
		"green": "#02BE01",
		"teal": "#00D3DD",
		"skyblue": "#0083C7",
		"blue": "#0000EA",
		"lavender": "#CF6EE4",
		"purple": "#820080",
	},
};
try {
	baseSettings = Object.assign(baseSettings, JSON.parse(localStorage.getItem("place-live:settings")));
} catch (error) {
	console.log("Saved settings has invalid JSON, reverting to defaults:", error);
}

const settings = new Proxy(baseSettings, {
	set: (target, ...rest) => {
		const result = Reflect.set(target, ...rest);
		localStorage.setItem("place-live:settings", JSON.stringify(target));
		return result;
	}
});

const board = document.getElementById("board");
board.style.height = board.clientWidth + "px";

board.height = document.getElementById("boardHeight").innerText =  settings.height;
board.width = document.getElementById("boardWidth").innerText = settings.width;

const settingsInput = document.getElementById("settings");
settingsInput.value = JSON.stringify(settings, null, "\t");
settingsInput.addEventListener("input", event => {
	let newValue = {};
	try {
		newValue = JSON.parse(event.target.value);
	} catch (error) {
		return console.log("Invalid JSON: ", error);
	}

	for (let key of Object.keys(newValue)) {
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

function saveBoardData(canvas = board, key = "place-live:board") {
	localStorage.setItem(key, canvas.toDataURL());
}

function placePixel(x, y, color) {
	ctx.fillStyle = color;
	ctx.fillRect(x, y, 1, 1);

	saveBoardData();
}

function time() {
	const now = new Date();

	const hours = now.getHours().toString().padStart(2);
	const minutes = now.getMinutes().toString().padStart(2, "0");
	const seconds = now.getSeconds().toString().padStart(2, "0");

	return `${hours}:${minutes}:${seconds}`;
}

const log = document.getElementById("log");
function addToLog(entry) {
	const lastEntries = log.innerText.split("\n").slice(-4);
	lastEntries.push(`[${time()}] ${entry}`);
	log.innerText = lastEntries.join("\n");
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

if (settings.commentSocketURL) {
	const socket = new WebSocket(settings.commentSocketURL);
	socket.addEventListener("open", () => console.log("Socket opened!"));
	socket.addEventListener("message", event => {
		let data = {};
		try {
			data = JSON.parse(event.data);
		} catch (error) {
			return console.log("Socket message data could not be parsed");
		}

		if (data.type !== "new_comment") return;

		const content = data.payload.body.toLowerCase().match(/([0-9]+) ([0-9]+) ([a-z]+)/);
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
}