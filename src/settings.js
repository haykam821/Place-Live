const { settings: log } = require("./debug.js");

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
	streamID: "",
	width: 120,
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

const settingsInput = document.getElementById("settings");
settingsInput.value = JSON.stringify(settings, null, "\t");
settingsInput.addEventListener("input", event => {
	let newValue = {};
	try {
		newValue = JSON.parse(event.target.value);
	} catch (error) {
		settingsInput.setCustomValidity("Invalid JSON");
		return log("Invalid JSON in settings input: ", error);
	}
	settingsInput.setCustomValidity("");

	for (const key of Object.keys(settings)) {
		settings[key] = newValue[key];
	}
});

module.exports = settings;
