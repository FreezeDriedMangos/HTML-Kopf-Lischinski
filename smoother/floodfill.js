// Colors as 32bit unsigned ints. Order ABGR
const black = 0xFF000000; // the background color that gets treated as "not yet filled" by the floodfill algorithm
const notQuiteBlack = 0xFF010101; // a hacky solve for when the image actually contains black pixels 
const clear = 0x00000000;
const white = 0xFFFFFFFF;
const red = 0xFF0000FF;
const green = 0xFF00FF00;
const blue = 0xFFFF0000;
const yellow = red | green;
const magenta = red | blue;


const borderColor = white

function floodfillNormalImage(colorCanvas, splineObjects, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage, blurBoundries=true) {
	const w = imgWidth*pixelSize;
	const boundaries = []

	floodfill(colorCanvas,
		(d32) => {
			// draw boundaries
			splineObjects.forEach(splineObject => {
				// canvas.lineTo doesn't support full alpha, so I made my own drawing code
				var path = splineObject.toPath(pixelSize)
				for (var i = 0; i < path.length-1; i++) {
					var vector = [path[i+1][0]-path[i][0], path[i+1][1]-path[i][1]] // vector from this point to the next point
					var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1]) // distance between this point and next point
					var dirNormalized = [vector[0]/mag, vector[1]/mag]             // direction to next point
					var magCiel = Math.ceil(mag)

					var loc = [path[i][0], path[i][1]]
					for (var j = 0; j <= magCiel+1; j++) {
						const indx = Math.trunc(loc[1])*w+Math.trunc(loc[0])
						d32[indx] = borderColor
						boundaries.push(indx)
						loc[0] += dirNormalized[0]
						loc[1] += dirNormalized[1]
					}
				}
			})
		},
		(d32) => {
			const retval = []
			
			splineObjects.forEach(splineObject => {
				// canvas.lineTo doesn't support full alpha, so I made my own drawing code
				var path = splineObject.toPath(pixelSize)
				for (var i = 0; i < path.length-1; i++) {
					var vector = [path[i+1][0]-path[i][0], path[i+1][1]-path[i][1]] // vector from this point to the next point
					var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1]) // distance between this point and next point
					var dirNormalized = [vector[0]/mag, vector[1]/mag]             // direction to next point
					var magCiel = Math.ceil(mag)


					var vertexIndex = Math.trunc((i/path.length)*splineObject.points.length)
					var colors = splineObject.colors[vertexIndex]

					if (!colors) continue

					var loc = [path[i][0], path[i][1]]
					for (var j = 0; j <= magCiel+1; j++) {
						const indxR = Math.ceil(loc[1]+dirNormalized[0])*w+Math.trunc(loc[0]-dirNormalized[1])
						const indxL = Math.ceil(loc[1]-dirNormalized[0])*w+Math.trunc(loc[0]+dirNormalized[1])
						
						if (d32[indxR] !== borderColor) {
							var rgbaR = colors.right
							const abgrR = (rgbaR[3] << 24) | (rgbaR[2] << 16) | (rgbaR[1] << 8) | (rgbaR[0])
							const abgrUnsignedR = abgrR >>> 0

							// d32[indxR] = abgrUnsignedR
							retval.push([indxR, abgrUnsignedR])
						}
						
						if (d32[indxL] !== borderColor) {
							var rgbaL = colors.left
							const abgrL = (rgbaL[3] << 24) | (rgbaL[2] << 16) | (rgbaL[1] << 8) | (rgbaL[0])
							const abgrUnsignedL = abgrL >>> 0

							// d32[indxL] = abgrUnsignedL
							retval.push([indxL, abgrUnsignedL])
						}
						
						loc[0] += dirNormalized[0]
						loc[1] += dirNormalized[1]
					}
				}
			})
			
			return retval
		},
		(d32) => {
			// fill in boundaries
			const pixOff = [w, -w, 1, -1];  // lookup for pixels left right top bottom
			for (const coord of boundaries) { for (const off of pixOff) d32[coord] = d32[coord] || d32[coord+off] } // sometimes boundaries are vertical or horizontal, so we'll just try every neighbor

			// blur boundaries
			if (blurBoundries) {
				const NUM_BLUR_PASSES = 2

				for (var i = 0; i < NUM_BLUR_PASSES; i ++) {
					const blurred = {}
					for (const coord of boundaries) { 
						//     + - +
						//     | a |
						// + - + - + - +
						// | d |   | c |
						// + - + - + - +
						//     | b |
						//     + - +
						
						var a = d32[coord+pixOff[0]]
						var b = d32[coord+pixOff[1]]
						var c = d32[coord+pixOff[2]]
						var d = d32[coord+pixOff[3]]

						// NOTE: pixels are stored as ABGR
						
						// convert to premultiplied alpha
						var aAlpha = Number((a >>> 24) & 0xFF) / 255.0
						a = (a & 0xFF000000) |
						    (Math.trunc(((a >>> 16) & 0xFF) * aAlpha) << 16) |
							(Math.trunc(((a >>>  8) & 0xFF) * aAlpha) <<  8) |
							(Math.trunc(((a >>>  0) & 0xFF) * aAlpha) <<  0)
						var bAlpha = Number((b >>> 24) & 0xFF) / 255.0
						b = (b & 0xFF000000) |
						    (Math.trunc(((b >>> 16) & 0xFF) * bAlpha) << 16) |
							(Math.trunc(((b >>>  8) & 0xFF) * bAlpha) <<  8) |
							(Math.trunc(((b >>>  0) & 0xFF) * bAlpha) <<  0)
						var cAlpha = Number((c >>> 24) & 0xFF) / 255.0
						c = (c & 0xFF000000) |
						    (Math.trunc(((c >>> 16) & 0xFF) * cAlpha) << 16) |
							(Math.trunc(((c >>>  8) & 0xFF) * cAlpha) <<  8) |
							(Math.trunc(((c >>>  0) & 0xFF) * cAlpha) <<  0)
						var dAlpha = Number((d >>> 24) & 0xFF) / 255.0
						d = (d & 0xFF000000) |
						    (Math.trunc(((d >>> 16) & 0xFF) * dAlpha) << 16) |
							(Math.trunc(((d >>>  8) & 0xFF) * dAlpha) <<  8) |
							(Math.trunc(((d >>>  0) & 0xFF) * aAlpha) <<  0)
						
						// blur formula from https://stackoverflow.com/a/8440673/9643841
						const blurVert = ( (((a ^ b) & 0xfefefefe) >>> 1) + (a & b) )
						const blurHoriz = ( (((c ^ d) & 0xfefefefe) >>> 1) + (c & d) )
						const blur = ( (((blurVert ^ blurHoriz) & 0xfefefefe) >>> 1) + (blurVert & blurHoriz) )

						// unconvert from premultiplied alpha
						var blurredAlpha = (Number((blur >>> 24) & 0xFF) / 255.0) || (1.0/255.0)
						blurred[coord] = (blur & 0xFF000000) |
						                 (Math.trunc(((blur >>> 16) & 0xFF) / blurredAlpha) << 16) |
							             (Math.trunc(((blur >>>  8) & 0xFF) / blurredAlpha) <<  8) |
							             (Math.trunc(((blur >>>  0) & 0xFF) / blurredAlpha) <<  0)
					}
					for (const coord of boundaries) { d32[coord] = blurred[coord] }
				}
			}
		}
	)
}


function floodfillDirectionVectorsImage(colorCanvas, splineObjects, imgWidth) {
	const w = imgWidth*pixelSize;

	floodfill(colorCanvas,
		(d32) => {},
		(d32) => {
			const retval = []
			const visited = {}
			// draw boundaries
			splineObjects.forEach(splineObject => {
				// canvas.lineTo doesn't support full alpha, so I made my own drawing code
				var path = splineObject.toPath(pixelSize)
				for (var i = 0; i < path.length-1; i++) {
					var vector = [path[i+1][0]-path[i][0], path[i+1][1]-path[i][1]]
					var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1])
					var dirNormalized = [vector[0]/mag, vector[1]/mag]
					var magCiel = Math.ceil(mag)

					var dirNormalized_ClampSpace = [dirNormalized[0]*0.5+0.5, dirNormalized[1]*0.5+0.5]
					if (dirNormalized_ClampSpace[0] < 0 || dirNormalized_ClampSpace[0] > 1 || 
						dirNormalized_ClampSpace[1] < 0 || dirNormalized_ClampSpace[1] > 1) console.log(dirNormalized_ClampSpace)

				    // vector dir color
					const zeroColor = 0xff000000 //0xff880000
					const dirColor = ((Math.trunc(0xff * dirNormalized_ClampSpace[0]) << 0) | (Math.trunc(0xff * dirNormalized_ClampSpace[1]) << 8) | zeroColor) >>> 0 // note: the >>> 0 makes this an unsigned int
					
					// // angle dir color
					// const dirColor = 0xff010000 | Math.trunc(0xff * Math.atan2(dirNormalized_ClampSpace[1], dirNormalized_ClampSpace[0])/(2*Math.PI)) 

					var loc = [path[i][0], path[i][1]]
					for (var j = 0; j <= magCiel; j++) {
						const indx = Math.trunc(loc[1])*w+Math.trunc(loc[0])
						if (!visited[indx]) {
							d32[indx] = dirColor
							retval.push([indx, dirColor])
							visited[indx] = true
						}
						loc[0] += dirNormalized[0]
						loc[1] += dirNormalized[1]
					}
				}
			})
			return retval
		},
		(d32) => {
			// blur boundaries
			//  const blurred = {}
			//  for (const coord of boundaries) { 
			// 	// blur formula from https://stackoverflow.com/a/8440673/9643841
			// 	const blur0 = ( ((((coord+pixOff[0]) ^ (coord+pixOff[1])) & 0xfefefefe) >> 1) + ((coord+pixOff[0]) & (coord+pixOff[0])) )
			// 	const blur1 = ( ((((coord+pixOff[2]) ^ (coord+pixOff[3])) & 0xfefefefe) >> 1) + ((coord+pixOff[2]) & (coord+pixOff[3])) )
			// 	blurred[coord] = ( ((((blur0) ^ (blur1)) & 0xfefefefe) >> 1) + ((blur0) & (blur1)) )
			//  }
			//  for (const coord of boundaries) { d32[coord] = blurred[coord] }
		}
	)
}

function floodfillEdgeDistanceFieldImage(colorCanvas, splineObjects, imgWidth) {
	const w = imgWidth*pixelSize;
	const gradientFalloff = 1/255

	floodfill(colorCanvas,
		(d32) => {},
		(d32) => {
			const retval = []
			const visited = {}
			// seed boundaries
			splineObjects.forEach(splineObject => {
				// canvas.lineTo doesn't support full alpha, so I made my own drawing code
				var path = splineObject.toPath(pixelSize)
				for (var i = 0; i < path.length-1; i++) {
					var vector = [path[i+1][0]-path[i][0], path[i+1][1]-path[i][1]]
					var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1])
					var dirNormalized = [vector[0]/mag, vector[1]/mag]
					var magCiel = Math.ceil(mag)

					var loc = [path[i][0], path[i][1]]
					for (var j = 0; j <= magCiel; j++) {
						const indx = Math.trunc(loc[1])*w+Math.trunc(loc[0])
						if (!visited[indx]) {
							d32[indx] = borderColor
							retval.push([indx, borderColor])
							visited[indx] = true
						}
						loc[0] += dirNormalized[0]
						loc[1] += dirNormalized[1]
					}
				}
			})
			return retval
		},
		(d32) => {
			// blur boundaries
			//  const blurred = {}
			//  for (const coord of boundaries) { 
			// 	// blur formula from https://stackoverflow.com/a/8440673/9643841
			// 	const blur0 = ( ((((coord+pixOff[0]) ^ (coord+pixOff[1])) & 0xfefefefe) >> 1) + ((coord+pixOff[0]) & (coord+pixOff[0])) )
			// 	const blur1 = ( ((((coord+pixOff[2]) ^ (coord+pixOff[3])) & 0xfefefefe) >> 1) + ((coord+pixOff[2]) & (coord+pixOff[3])) )
			// 	blurred[coord] = ( ((((blur0) ^ (blur1)) & 0xfefefefe) >> 1) + ((blur0) & (blur1)) )
			//  }
			//  for (const coord of boundaries) { d32[coord] = blurred[coord] }
		},
		gradientFalloff
	)
}


function floodfillGhostEdgeDistanceFieldImage(colorCanvas, splineObjects, imgWidth) {
	const w = imgWidth*pixelSize;
	const gradientFalloff = 1/255

	floodfill(colorCanvas,
		(d32) => {},
		(d32) => {
			const retval = []
			const visited = {}
			// seed boundaries
			splineObjects.forEach(splineObject => {
				// canvas.lineTo doesn't support full alpha, so I made my own drawing code
				var path = splineObject.toPath(pixelSize)
				for (var i = 0; i < path.length-1; i++) {
					var vector = [path[i+1][0]-path[i][0], path[i+1][1]-path[i][1]]
					var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1])
					var dirNormalized = [vector[0]/mag, vector[1]/mag]
					var magCiel = Math.ceil(mag)

					var loc = [path[i][0], path[i][1]]
					for (var j = 0; j <= magCiel; j++) {
						const indx = Math.trunc(loc[1])*w+Math.trunc(loc[0])
						if (!visited[indx]) {
							d32[indx] = borderColor
							// TODO: don't push if indx is a point on another non-ghost spline
							if (splineObject.isGhostSpline) retval.push([indx, borderColor]) // only seed ghost splines
							visited[indx] = true
						}
						loc[0] += dirNormalized[0]
						loc[1] += dirNormalized[1]
					}
				}
			})
			return retval
		},
		(d32) => {},
		gradientFalloff
	)
}

// high performance flood fill modified from https://codereview.stackexchange.com/a/212994
const floodfill = function (colorCanvas, preseedCallback, seedFunction, cleanupCallback, gradientFalloff) {
	"use strict"; // Always for performant code

	const cvs = colorCanvas //document.getElementById("paint");
	const width = cvs.width;  // Get potencial slow accessors into vars.
	const w = cvs.width;  // alias
	const height = cvs.height;
	const size = width * height;
	const ctx = cvs.getContext('2d');

	const gradient = 0x00FFFFFF * (gradientFalloff || 0); // gradientFalloff is a float on [0-1]

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
					d32[nIdx] = d32[idx] - gradient;
					queue.push(nIdx);
				}
			}
		}
	}

	for (const pixel of start) { d32[pixel[0]] = pixel[1] }
	cleanupCallback(d32, start)

	ctx.putImageData(imageData, 0, 0);
}