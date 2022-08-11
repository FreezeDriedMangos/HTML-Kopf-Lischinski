
	// high performance flood fill from https://codereview.stackexchange.com/a/212994
const floodfill = function (colorCanvas, preseedCallback, seedFunction, cleanupCallback) {
	"use strict"; // Always for performant code

	// Colors as 32bit unsigned ints. Order ABGR
	const black = 0xFF000000;
	const notQuiteBlack = 0xFF010101;
	const clear = 0x00000000;
	const red = 0xFF0000FF;
	const green = 0xFF00FF00;
	const blue = 0xFFFF0000;
	const yellow = red | green;
	const magenta = red | blue;

	const cvs = colorCanvas //document.getElementById("paint");
	const width = cvs.width;  // Get potencial slow accessors into vars.
	const w = cvs.width;  // alias
	const height = cvs.height;
	const size = width * height;
	const ctx = cvs.getContext('2d');

	// black background
	ctx.fillStyle = "black";
	ctx.fillRect(0, 0, width, height);

	const imageData = ctx.getImageData(0, 0, width, height);

	// Use 32bit buffer for single pixel read writes
	const d32 = new Uint32Array(imageData.data.buffer);  


	// const start = [
	// 	// [40 * w + 40, red],  // work in precalculated pixel indexes
	// 	// [10 * w + 20, green],
	// 	// [23 * w + 42, blue],
	// 	// [300 * w +333, yellow],
	// 	// [200 * w + 333, magenta]
	// ];

	preseedCallback(d32)
	const start = seedFunction(d32)

	const pixOff = [w, -w, 1, -1];  // lookup for pixels left right top bottom
	const pixOffX = [0, 0, 1, -1];  // lookup for pixel x left right

	const queue = [];  // keep queue content as simple as possible.
	for (const pixel of start) { 
		queue.push(pixel[0]);     // Populate the queue
		d32[pixel[0]] = pixel[1]; // Write pixel directly to buffer
	}
	
	while (queue.length) {
		const idx = queue.shift();
		const x = idx % w; // Need the x coord for bounds test
		for (let i = 0; i< pixOff.length; i++) {
			const nIdx = idx + pixOff[i]; 
			if (d32[nIdx] === black) {   // Pixels off top and bottom 
											// will return undefined
				const xx = x + pixOffX[i];
				if (xx > -1 && xx < w ) {
					d32[nIdx] = d32[idx];
					queue.push(nIdx);
				}
			}
		}
	}

	for (const pixel of start) { d32[pixel[0]] = pixel[1] }
	cleanupCallback(d32, start)

	ctx.putImageData(imageData, 0, 0);
}