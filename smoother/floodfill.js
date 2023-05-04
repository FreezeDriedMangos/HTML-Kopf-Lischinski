// Colors as 32bit unsigned ints. Order ABGR
const black = 0xFF000000; // the background color that gets treated as "not yet filled" by the floodfill algorithm
const notQuiteBlack = 0xFF010101; // a hacky solve for when the image actually contains black pixels 
const clear = 0x00000000;
const red = 0xFF0000FF;
const green = 0xFF00FF00;
const blue = 0xFFFF0000;
const yellow = red | green;
const magenta = red | blue;

function floodfillNormalImage(colorCanvas, splineObjects, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage) {
	const w = imgWidth*pixelSize;
	const boundaries = []

	floodfill(colorCanvas,
		(d32) => {
			// draw boundaries
			splineObjects.forEach(splineObject => {
				// canvas.lineTo doesn't support full alpha, so I made my own drawing code
				var path = splineObject.toPath(pixelSize)
				for (var i = 0; i < path.length-1; i++) {
					var vector = [path[i+1][0]-path[i][0], path[i+1][1]-path[i][1]]
					var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1])
					var dirNormalized = [vector[0]/mag, vector[1]/mag]
					var magCiel = Math.ceil(mag)

					var loc = [path[i][0], path[i][1]]
					for (var j = 0; j <= magCiel+1; j++) {
						const indx = Math.trunc(loc[1])*w+Math.trunc(loc[0])
						d32[indx] = clear
						boundaries.push(indx)
						loc[0] += dirNormalized[0]
						loc[1] += dirNormalized[1]
					}
				}
			})
		},
		(d32) => {
			const retval = []
			// seed the image from the pixel centers
			for(var x = 0; x < imgWidth; x++) {
				for(var y = 0; y < imgHeight; y++) {
					// detect if a pixel is outside its bounds somehow

					const canvasY = y*pixelSize + pixelSize/2 
					const canvasX = x*pixelSize + pixelSize/2
					const idx = canvasY*w+canvasX
					if (d32[idx] !== black) continue
					
					// check each of this pixels __unconnected__ neighbors. if any of them can be reached without hitting a boundary (ie clear) pixel, skip this seed, it's a leaked pixel (ie the boundary that's supposed to enclose this pixel has moved, and the pixel is no longer enclosed)
					var skipSeed = false
					for (var i = 0; i < deltas.length; i++) {
						if (similarityGraph[x][y][i]) continue
						try {
							const diagPart1A = yuvImage[x+deltas[i][0]][y]
							const diagPart1B = yuvImage[x][y+deltas[i][1]]
							const diagPart2 = yuvImage[x+deltas[i][0]][y+deltas[i][1]]

							if (i%2 === 0) // this is a diagonal
								// if xy is connected to this neighbor indirectly, this must be a case where the diagonal was removed between similar colors
								if (  (!differentColors(yuvImage[x][y], diagPart1A) && !differentColors(diagPart1A, diagPart2)) 
									||(!differentColors(yuvImage[x][y], diagPart1B) && !differentColors(diagPart1B, diagPart2))) continue; 
						} catch { continue; } // catch triggers if out of bounds

						var loc = [canvasX, canvasY]
						
						var blocked = false
						for (var j = 0; j <= pixelSize; j++) {
							loc[0] += deltas[i][0]
							var indx = Math.trunc(loc[1])*w+Math.trunc(loc[0])
							if (d32[indx] === clear) { blocked = true; break; }

							loc[1] += deltas[i][1]
							indx = Math.trunc(loc[1])*w+Math.trunc(loc[0])
							if (d32[indx] === clear) { blocked = true; break; }
						}

						if (!blocked) { skipSeed = true; break; }
					}

					if (skipSeed) continue;

					var rgba = getPixelData(x, y)
					const abgr = (rgba[3] << 24) | (rgba[2] << 16) | (rgba[1] << 8) | (rgba[0])
					retval.push([idx, abgr === black ? notQuiteBlack : abgr])
				}
			}
			return retval
		},
		(d32) => {
			// fill in boundaries
			const pixOff = [w, -w, 1, -1];  // lookup for pixels left right top bottom
			for (const coord of boundaries) { for (const off of pixOff) d32[coord] = d32[coord] || d32[coord+off] } // sometimes boundaries are vertical or horizontal, so we'll just try every neighbor

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
			// draw boundaries
			splineObjects.forEach(splineObject => {
				// canvas.lineTo doesn't support full alpha, so I made my own drawing code
				var path = splineObject.toPath(pixelSize)
				for (var i = 0; i < path.length-1; i++) {
					var vector = [path[i+1][0]-path[i][0], path[i+1][1]-path[i][1]]
					var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1])
					var dirNormalized = [vector[0]/mag, vector[1]/mag]
					var magCiel = Math.ceil(mag)

					const borderColor = 0xffffffff

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