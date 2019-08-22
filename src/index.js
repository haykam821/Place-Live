const screen = document.getElementById("screen");
screen.style.height = window.innerHeight + "px";
screen.style.width = (480 / 854) * window.innerHeight + "px";

let baseSettings = {
	width: 120,
	height: 120,
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

board.height = settings.height;
board.width = settings.width;

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