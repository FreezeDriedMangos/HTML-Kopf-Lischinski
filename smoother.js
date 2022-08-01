
var svgns = "http://www.w3.org/2000/svg";

const inputImageElementID = 'my-image';

const ISLAND_SCORE = 13//5
const AREA_SCORE_WEIGHT = 1

//
// Trying to load a single image file from the same directory that this html file exists in. God help me
//

// https://stackoverflow.com/a/42498790/9643841
var openFile = function(file) {
    var input = file.target;

    var reader = new FileReader();
    reader.onload = function(){
		var dataURL = reader.result;
		var output = document.getElementById(inputImageElementID);
		output.src = dataURL;
		
		var image = document.createElement("img");
		image.src = dataURL;
		console.log(image.width) // logging the size seems to initialize it
		console.log(image.height)

		if (image.width === 0 || image.height === 0) {
			document.getElementById("warning").innerHTML+= "Image failed to load. Please refresh and try again. (this is very buggy, it will probably work on the 3rd try)"
		}
		
		init()
    };
    reader.readAsDataURL(input.files[0]);
};

//
// actually proccess the damn thing
//

function init() {
	// https://stackoverflow.com/a/8751659/9643841
	var canvas = null;
	var imgWidth = 0;
	var imgHeight = 0;
	function loadImage() {
		var img = document.getElementById(inputImageElementID);
		
		canvas = document.createElement('canvas');
		imgWidth = canvas.width = img.width;
		imgHeight = canvas.height = img.height;
		canvas.getContext('2d').imageSmoothingEnabled = false
		canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
		console.log({imgWidth, imgHeight})
	}
	function getPixelData(x, y) {
		return canvas.getContext('2d').getImageData(x, y, 1, 1).data;
	}
	loadImage();

	// responding to user click
	// var pixelData = canvas.getContext('2d').getImageData(event.offsetX, event.offsetY, 1, 1).data;


	//
	// Color Utility
	//

	// https://stackoverflow.com/a/5624139/9643841
	function componentToHex(c) {
		var hex = c.toString(16);
		return hex.length == 1 ? "0" + hex : hex;
	}
	function rgbToHex(r, g, b, a) {
		return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b) + componentToHex(a);
	}

	// https://stackoverflow.com/a/17934865
	function RGBtoYUV(r, g, b, a=255) {
		const y = Math.floor( 0.257 * r + 0.504 * g + 0.098 * b +  16);
		const u = Math.floor(-0.148 * r - 0.291 * g + 0.439 * b + 128);
		const v = Math.floor( 0.439 * r - 0.368 * g - 0.071 * b + 128);
		return [y, u, v, a]
	}

	function dissimilarColors(yuv1, yuv2) {
		if (yuv1[3] !== undefined || yuv2[3] !== undefined) // if they have alpha components
			if ((yuv1[3] === 0) !== (yuv2[3] === 0)) return true; // if one is completely transparent and the other is not, the pixels are automatically considered dissimilar

		var dy = Math.abs(yuv1[0]-yuv2[0]) > 48;
		var du = Math.abs(yuv1[1]-yuv2[1]) > 7 ;
		var dv = Math.abs(yuv1[2]-yuv2[2]) > 6 ;
		return dy || du || dv;	
	}

	//
	// SVG functions
	//

	// https://stackoverflow.com/a/8215105/9643841
	function initSVG(width = 300, height = 300) {
		var svg = document.createElementNS(svgns, "svg");
		svg.setAttribute('width', width);
		svg.setAttribute('height', height);
		document.body.appendChild(svg);
		return svg
	}

	// https://stackoverflow.com/a/12786915/9643841
	function makeSquare(svg, x, y, size, color) {
		var rect = document.createElementNS( svgns,'rect' );
		rect.setAttributeNS( null,'x',x );
		rect.setAttributeNS( null,'y',y );
		rect.setAttributeNS( null,'width',`${size}` );
		rect.setAttributeNS( null,'height',`${size}` );
		if (color) rect.setAttributeNS( null,'fill',color );
		svg.appendChild(rect)
	}

	function makeLine(svg, x1, y1, x2, y2, color=[0, 0, 0], width=1) {
		//  <line x1="0" y1="0" x2="200" y2="200" style="stroke:rgb(255,0,0);stroke-width:2" />
		
		var line = document.createElementNS( svgns,'line' );
		line.setAttributeNS( null,'x1',x1 );
		line.setAttributeNS( null,'y1',y1 );
		line.setAttributeNS( null,'x2',x2 );
		line.setAttributeNS( null,'y2',y2 );
		line.setAttributeNS( null,'style',`stroke:rgb(${color[0]}, ${color[1]}, ${color[2]});stroke-width:${width}` );
		svg.appendChild(line)
	}
	
	function makePolygon(svg, points, color="#000000") {
		var polygon = document.createElementNS( svgns,'polygon' );
		polygon.setAttributeNS( null,'points', points.map(([x, y]) => x+","+y).join(" ") );
		if (color) polygon.setAttributeNS( null,'fill',color );
		svg.appendChild(polygon)
	}

	
	//
	// show input
	//

	var pixelSize = 10
	
	// show the input image
	var inputCopySVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			makeSquare(inputCopySVG, x*pixelSize, y*pixelSize, pixelSize, rgbToHex(...getPixelData(x, y)))
		}
	}
	

	//
	// Output and main body of the Kopf-Lischinski Algorithm
	//

	// compute the yuv colorspace values of each pixel
	var yuvImage = []
	for (var x = 0; x < imgWidth; x++) {
		yuvImage.push([])
		for (var y = 0; y < imgHeight; y++) {
			yuvImage[x].push(RGBtoYUV(...getPixelData(x, y)))
		}
	}

	// similarity graph
	
	// for a given pixel #, its neighbors' relative coordinates are listed in deltas with the following indexes
	// 0 1 2
	// 7 # 3
	// 6 5 4

	var similarityGraph = []; // format: similarityGraph[x][y] => [upperLeftPixel is similar, upperPixel is similar, upperRightPixel is similar, ...] // (out-of-bounds pixels are never considered similar)
	var deltas = [
		[-1,-1], [0,-1], [1,-1], [1,0], [1, 1], [0,1], [-1,1], [-1,0]
	];
	var deltaDownRight_index = 4
	var deltaDownLeft_index = 6
	var deltaRight_index = 3
	var deltaUpLeft_index = 0
	var deltaUpRight_index = 2


	for (var x = 0; x < imgWidth; x++) {
		similarityGraph.push([])
		for (var y = 0; y < imgHeight; y++) {
			similarityGraph[x].push([])
			for (var i = 0; i < deltas.length; i++) {
				var delta = deltas[i]
				var newX = x + delta[0]
				var newY = y + delta[1]
				try { similarityGraph[x][y].push(!dissimilarColors(yuvImage[x][y], yuvImage[newX][newY])) } 
				catch { similarityGraph[x][y].push(false) }
				// if (newX < 0 || newX >= imgWidth || newY < 0 || newY >= imgHeight) similarityGraph[x][y].push(true)
				// else similarityGraph[x][y].push(!dissimilarColors(yuvImage[x, y], yuvImage[newX, newY]))
			}
		}
	}

	// detect crossings
	
	for (var x = 0; x < imgWidth-1; x++) {
		for (var y = 0; y < imgHeight-1; y++) {
			// detecting the crossing formed by (x,y)comp(x+1,y+1) and (x+1,y)comp(x,y+1)
			var diag1 = similarityGraph[x][y][deltaDownRight_index]  // (x,y)comp(x+1,y+1)
			var diag2 = similarityGraph[x+1][y][deltaDownLeft_index] // (x+1,y)comp(x,y+1)
			var removeDiag1 = false
			var removeDiag2 = false
			
			if (!diag1 || !diag2) continue; // no crossing

			// check for fully connected
			var fullyConnected = similarityGraph[x][y][deltaRight_index] // if a pixel from one diagonal is similar to a pixel from another diagonal, all four pixels are similar. we can remove both diagonals
			if (fullyConnected)
				removeDiag1 = removeDiag2 = true
			else {
				//
				// handle diagonal crossing resolution
				//
				var diag1Score = 0
				var diag2Score = 0
				
				function numConnections(nodeConnections) { return nodeConnections.reduce((snowball, snow) => snowball+(snow?1:0), -1) } // -1 accounts for the self connection
				
				
				// TODO: implement curve detection (note: make improvement by detecting double lined curves)
				
				// patterns of pixels that are part of 2 width lines
				//                 
				//    #         #        #   
				//   #O        O#       O#
				//   #        ##                
				//                 
				//                      

				// sparse pixels heuristic
				var diag1SimilarCount = 0
				var diag2SimilarCount = 0
				for (var dx = -3; dx <= 4; dx++) {
					for (var dy = -3; dy <= 4; dy++) {
						try{ if (!dissimilarColors(yuvImage[x][y],   yuvImage[x+dx][y+dy])) diag1SimilarCount++ } catch {} // try/catch to handle trying to access pixels outside the bounds of the image
						try{ if (!dissimilarColors(yuvImage[x+1][y], yuvImage[x+dx][y+dy])) diag2SimilarCount++ } catch {} // they don't exist (so are always dissimilar), so they'll never contribute to the diagSimilarCount anyway
					}
				}
				diag1Score -= AREA_SCORE_WEIGHT*diag1SimilarCount // lower area = we want it connected more
				diag2Score -= AREA_SCORE_WEIGHT*diag2SimilarCount

				// islands heuristic
				
				var diag1HasIsland = numConnections(similarityGraph[x][y]) == 1 || numConnections(similarityGraph[x+1][y+1]) == 1
				var diag2HasIsland = numConnections(similarityGraph[x+1][y]) == 1 || numConnections(similarityGraph[x][y+1]) == 1

				if (diag1HasIsland) diag1Score += ISLAND_SCORE
				if (diag2HasIsland) diag2Score += ISLAND_SCORE

				if (diag1Score == diag2Score) diag1Score += (Math.random()-0.5) // if resolution failed, pick one randomly?
				if (diag1Score > diag2Score) removeDiag2 = true
				if (diag1Score < diag2Score) removeDiag1 = true
			}

			// remove diagonals marked for removal
			if (removeDiag1) {
				similarityGraph[x][y][deltaDownRight_index] = false
				similarityGraph[x+1][y+1][deltaUpLeft_index] = false
			}
			
			if (removeDiag2) {
				similarityGraph[x+1][y][deltaDownLeft_index] = false
				similarityGraph[x][y+1][deltaUpRight_index] = false
			}
		}
	}

	
	// draw similarity graph
	// var similarityGraphSVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	// for (var x = 0; x < imgWidth; x++) {
	// 	for (var y = 0; y < imgHeight; y++) {
	// 		if(yuvImage[x][y][3] <= 0) continue;
	// 		makeSquare(similarityGraphSVG, x*pixelSize, y*pixelSize, pixelSize, rgbToHex(...yuvImage[x][y])) // rgbToHex(...getPixelData(x, y))
	// 	}
	// }
	// for (var x = 0; x < imgWidth; x++) {
	// 	for (var y = 0; y < imgHeight; y++) {
	// 		for (var i = 0; i < deltas.length; i++) {
	// 			var delta = deltas[i]

	// 			var newX = x + delta[0]
	// 			var newY = y + delta[1]
	// 			// if (newX < 0 || newX >= imgWidth || newY < 0 || newY >= imgHeight) continue
	// 			if (similarityGraph[x][y][i] == false) continue;
	// 			makeLine(similarityGraphSVG, x*pixelSize+pixelSize/2, y*pixelSize+pixelSize/2, newX*pixelSize+pixelSize/2, newY*pixelSize+pixelSize/2)
	// 		}
	// 	}
	// }

	//
	// Converting from similarity graph to voronoi diagram
	//

	// for each pixel, represent its list of connections (the value of similarityGraph[x][y]) as a binary string, where the nth bit means this pixel has a connection on the similarity graph to its neighbor n, as represented on the below key:
	// 0 1 2
	// 7   3
	// 6 5 4
	//
	// for example, the below connection pattern would be represented as 01100100
	//   |/
	//   |
	//
	// because of symmetry, we only need to store one rotation / mirror of each pattern and allow for one mirror and one rotation transformation (I'll use 90deg clockwise rotation and vertical mirroring)
	// eg, this  |/   is the same as this  \|
	//           |                          |
	//
	// To rotate a connection pattern bit string, the operation is simply a looping right shift 2. ie, take the last two bits and make them the first two
	// 01100100 -> 00011001
	// 
	// To vertically mirror a connection pattern bit string, the operation is to loop right shift 1 and then reverse the string
	// 01100100 -> 00110010 -> 01001100
	//
	//
	// each pixel will be conversion into some polygon. but because of the rules of this conversion, (and some other outside factors, such as no lines crossing, pixels being perfectly aligned to grid, etc)
	// there are actually only 12 possible points for each vertex to be placed, relative to the center of the pixel. I've labeled each position with an index below. The square is the original bounds of the pixel
	// (note for who's interested: I chose this ordering of the 12 possible vertices by ordering the vertices by their angle from the center pixel)
	//
	//            2    3
	//   
	//       1--------------5
	//       |              |
	//  15   |    0    4    |    6
	//       |              |
	//  14   |   12    8    |    7
	//       |              |
	//      13--------------9
	//       
	//           11   10
	// 
	// unfortunately, having the corner points colinear with the inner 4 points (with respect to a ray starting at the center of the square) means mirroring isn't a simple operation, and instead it'll just be handled by a dictionary :(
	// 90deg clockwise rotation though, is very nice: vertices.map(v => (v+12)%16)
	//

	const connectionPatterns_toVoronoiVerts = {
		"00000000": [0, 4, 8, 12],

		// 1 connection
		"00000100": [0, 4, 9, 13],
		"00100000": [0, 3, 5, 6, 8, 12],

		// 2 connections
		"00010100": [0, 5, 9, 13],
		"00100100": [0, 3, 5, 6, 9, 13],
		"00100010": [14, 0, 3, 5, 6, 8, 11, 13],
		"00010001": [1, 5, 9, 13], // is this right?
		"00001010": [0, 4, 7, 9, 10, 11, 13, 14],
		"01100000": [1, 5, 6, 8, 12], // unsure

		// 3 connections
		"01100100": [1, 5, 6, 9, 13],
		"00110010": [3, 5, 9, 11, 13, 14, 0],
		"01100001": [1, 5, 6, 8, 13], // unsure
		"01000101": [1, 5, 9, 13],

		"00001110": [0, 4, 7, 9, 13, 14], 
		"00011010": [0, 5, 9, 10, 11, 13, 14],

		"01001010": [1, 5, 7, 9, 10, 11, 13, 14],
		"10100010": [15, 1, 2, 3, 5, 6, 8, 11, 13, 14],

		// 4 connections
		"01100011": [1, 5, 6, 8, 11, 13], 
		"01010011": [1, 5, 9, 11, 13],
		"00110011": [1, 3, 5, 9, 11, 13],
		"00011011": [1, 5, 9, 10, 11, 13], 
		"01010101": [1, 5, 9, 13],
		"00101011": [1, 3, 5, 6, 7, 9, 10, 11, 13], // unsure
		"10101010": [2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 1],

		"11100010": [1, 2, 3, 5, 6, 8, 11, 13, 14, 15], 

		// 5 connections
		"10110101": [1, 2, 3, 5, 9, 13],
		"11100110": [1, 5, 6, 9, 13, 14, 15],
		
		"01010111": [1, 5, 9, 13], // shouldn't exist really
		
	}
	const s = 0.25; // s for step
	const voronoiCellVertexPositions = { // [0, 0] is the top left of the pixel
		0:  [s, s],
		1:  [0, 0],
		2:  [s, -s],
		3:  [3*s, -s],
		4:  [3*s, s],
		5:  [4*s, 0],
		6:  [5*s, s],
		7:  [5*s, 3*s],
		8:  [3*s, 3*s],
		9:  [4*s, 4*s],
		10: [3*s, 5*s],
		11: [s, 5*s],
		12: [s, 3*s],
		13: [0, 4*s],
		14: [-s, 3*s],
		15: [-s, s],
	}

	const voronoiVertMirror = {
		0:  12,
		1:  13, 
		2:  11,
		3:  10,
		4:  8,
		5:  9,
		6:  7,
		7:  6,
		8:  4,
		9:  5,
		10: 3,
		11: 2,
		12: 0,
		13: 1,
		14: 15,
		15: 14,
	}

	function connectionArrayToBitString(arr) {
		// arr is of form [0, 1, 2, 7, -, 3, 6, 5, 4]
		//                 0  1  2  3  4  5  6  7  8
		const newArr = arr //[arr[0], arr[1], arr[2], arr[5], arr[8], arr[7], arr[6], arr[3]]
		return newArr.reduce((snowball, snow) => snowball + (snow? "1" : "0"), "")
	}

	function bitstringTransform_90deg(bitstring) {
		return bitstring.substring(2) + bitstring.substring(0, 2) // bitstring.substring(6) + bitstring.substring(0, 6)
	}
	
	function bitstringTransform_mirror(bitstring) {
		bitstring = bitstring.substring(7) + bitstring.substring(0, 7)
		return [...bitstring].reverse().join(""); // https://stackoverflow.com/a/959004/9643841
	}

	function voronoiVertsTransform_90deg(verts) {
		if (!verts) return null
		return verts.map(v => (v+12)%16)
	}

	function voronoiVertsTransform_mirror(verts) {
		if (!verts) return null
		return verts.map(v => voronoiVertMirror[v])
	}

	var voronoiVerts = [] // voronoiVerts[x][y] => list of [absoluteX, absoluteY] points defining the voronoi cell's shape for this pixel
	for (var x = 0; x < imgWidth; x++) {
		voronoiVerts.push([])
		
		for (var y = 0; y < imgHeight; y++) {
			voronoiVerts[x].push([])

			const patternBitstring = connectionArrayToBitString(similarityGraph[x][y])

			// test un-mirrored

			var patternTest = patternBitstring
			var thisVoronoiVerts = connectionPatterns_toVoronoiVerts[patternTest]
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts); continue }

			patternTest = bitstringTransform_90deg(patternBitstring)
			thisVoronoiVerts = voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(connectionPatterns_toVoronoiVerts[patternTest]))) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts); continue }

			patternTest = bitstringTransform_90deg(bitstringTransform_90deg(patternBitstring))
			thisVoronoiVerts = voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(connectionPatterns_toVoronoiVerts[patternTest])) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts); continue }

			patternTest = bitstringTransform_90deg(bitstringTransform_90deg(bitstringTransform_90deg(patternBitstring)))
			thisVoronoiVerts = voronoiVertsTransform_90deg(connectionPatterns_toVoronoiVerts[patternTest]) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts); continue }
			
			// test mirrored
			
			var patternTest = bitstringTransform_mirror(patternBitstring)
			var thisVoronoiVerts = voronoiVertsTransform_mirror(connectionPatterns_toVoronoiVerts[patternTest])
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts); continue }

			patternTest = bitstringTransform_mirror(bitstringTransform_90deg(patternBitstring))
			thisVoronoiVerts = voronoiVertsTransform_90deg( voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(voronoiVertsTransform_mirror(connectionPatterns_toVoronoiVerts[patternTest]))) ) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts); continue }

			patternTest = bitstringTransform_mirror( bitstringTransform_90deg(bitstringTransform_90deg(patternBitstring)) )
			thisVoronoiVerts = voronoiVertsTransform_90deg( voronoiVertsTransform_90deg(voronoiVertsTransform_mirror(connectionPatterns_toVoronoiVerts[patternTest])) ) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts); continue }

			patternTest = bitstringTransform_mirror( bitstringTransform_90deg(bitstringTransform_90deg(bitstringTransform_90deg(patternBitstring))) )
			thisVoronoiVerts = voronoiVertsTransform_90deg( voronoiVertsTransform_mirror(connectionPatterns_toVoronoiVerts[patternTest]) ) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts); continue }
			
			// nothing found
			console.log("No pattern matched for " + patternBitstring)
		}
	}

	function replaceElement(array, elem, newElem) {
		try { array[array.indexOf(elem)] = newElem } 
		catch { return false }
		return true
	}

	// fix corners where 3 or 4 dissimilar colors meet
	// let's just make this manual
	// for (var x = 0; x < imgWidth-1; x++) {
	// 	for (var y = 0; y < imgHeight-1; y++) {
	// 		//if (yuvImage[x][y][3] === 0) continue // if this is a transparent pixel, ignore it

	// 		var dissimilars = []
	// 		// if at least two of these
	// 		// var pair1Dissimilar = dissimilarColors(yuvImage[x][y],   yuvImage[x+1][y])   ? 1 : 0
	// 		// var pair2Dissimilar = dissimilarColors(yuvImage[x][y],   yuvImage[x][y+1])   ? 1 : 0
	// 		// var pair3Dissimilar = dissimilarColors(yuvImage[x][y],   yuvImage[x+1][y+1]) ? 1 : 0
	// 		// var topLeftPixelHasAtLeastTwoDissimilars = pair1Dissimilar + pair2Dissimilar + pair3Dissimilar >= 2

	// 		// ignore transparent pixels
	// 		if (/*yuvImage[x+1][y]  [3] !== 0 &&*/ dissimilarColors(yuvImage[x][y], yuvImage[x+1][y])  ) dissimilars.push(yuvImage[x+1][y]  )	
	// 		if (/*yuvImage[x][y+1]  [3] !== 0 &&*/ dissimilarColors(yuvImage[x][y], yuvImage[x][y+1])  ) dissimilars.push(yuvImage[x][y+1]  )	
	// 		if (/*yuvImage[x+1][y+1][3] !== 0 &&*/ dissimilarColors(yuvImage[x][y], yuvImage[x+1][y+1])) dissimilars.push(yuvImage[x+1][y+1])		
			
	// 		console.log(`${x},${y} ${dissimilars.length}`)

	// 		var atLeastThreeDissimilars = false
	// 		while(dissimilars.length > 0) {
	// 			var testColor = dissimilars.pop()
	// 			for (var i = 0; i < dissimilars.length; i++) {
	// 				if (dissimilarColors(testColor, dissimilars[i])) {
	// 					atLeastThreeDissimilars = true
	// 					break
	// 				}
	// 			}

	// 			if (atLeastThreeDissimilars) break
	// 		}

	// 		// // and at least one of these
	// 		// var pair4Dissimilar = dissimilarColors(yuvImage[x+1][y],   yuvImage[x][y+1])   && 
	// 		// var pair5Dissimilar = dissimilarColors(yuvImage[x+1][y],   yuvImage[x+1][y+1])

	// 		// var pair6Dissimilar = dissimilarColors(yuvImage[x][y+1],   yuvImage[x+1][y+1])

	// 		// var atLeastOneOtherPixelHasAtLeastOneOtherDissimilar = pair4Dissimilar || pair5Dissimilar || pair6Dissimilar

	// 		// // then pixel xy;s bottom right corner is a meeting of 3 or 4 different colors
	// 		// if (topLeftPixelHasAtLeastTwoDissimilars && atLeastOneOtherPixelHasAtLeastOneOtherDissimilar) {
	// 		if (atLeastThreeDissimilars) {
	// 			// if any of these four pixels have an inset corner, pop that corner back out
	// 			replaceElement(voronoiVerts[x][y],     8,  9) 
	// 			replaceElement(voronoiVerts[x+1][y],   12, 13) 
	// 			replaceElement(voronoiVerts[x][y+1],   4,  5) 
	// 			replaceElement(voronoiVerts[x+1][y+1], 0,  1) 
	// 		}
	// 	}
	// }

	// draw voronoi :)
	var voronoiSVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	var skipSimilarityGraph = false;
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			makePolygon(voronoiSVG, voronoiVerts[x][y].map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy]).map(([x, y]) => [pixelSize*x, pixelSize*y]), rgbToHex(...getPixelData(x, y)))

			// draw similarity graph on top
			if (skipSimilarityGraph) continue;
			for (var i = 0; i < deltas.length; i++) {
				var delta = deltas[i]

				var newX = x + delta[0]
				var newY = y + delta[1]
				// if (newX < 0 || newX >= imgWidth || newY < 0 || newY >= imgHeight) continue
				if (similarityGraph[x][y][i] == false) continue;
				makeLine(voronoiSVG, x*pixelSize+pixelSize/2, y*pixelSize+pixelSize/2, newX*pixelSize+pixelSize/2, newY*pixelSize+pixelSize/2)
			}
		}
	}

	//
	// splines
	//

	function listVoronoiCellEdges(x, y) {
		var thisPixelVoronoiVerts = [...voronoiVerts[x][y], voronoiVerts[x][y][0]]
		var edges = []
		for (var i = 0; i < voronoiVerts[x][y].length; i++) {
			edges.push([voronoiVerts[i]])
		}
	}

	// draw splines between all dissimilar colors, along the voronoi edges they share
	var nextNeighbors = [3, 4, 5, 6]
	var previousNeighbors = [7, 0, 1, 2]

	// var possibleEdgesSharedWithNeighbor = {
	// 	3: [ [5,4], [5,8], [5,9], [5,7], [4,7], [4,8], [4,9], [6,7], [6,8], [6,9], [8,9], ],
	// 	4: [ [7,10], /*[7,9],*/ [9,10], [6,8], [8,11] ],
	// }
	// possibleEdgesSharedWithNeighbor[5] = possibleEdgesSharedWithNeighbor[3].map(edge => voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(voronoiVertsTransform_90deg((edge)))))
	// possibleEdgesSharedWithNeighbor[6] = possibleEdgesSharedWithNeighbor[4].map(edge => voronoiVertsTransform_90deg(edge))

	// new strategy: make a voronoiVertexIndex but for the whole pixel grid
	// so basically, assign a unique number to every point on the entire pixel grid that can be a valid voronoi vertex
	// then, in the for loop below, create an adjacency list of these

	// note: this numbering system would mean each pixel would "own" four points: the top left corner and the four inner points: [1, 0,4,12,8]
	// so,
	// 1 -> (y*imageWidth+x)*5 + 0
	// 0 -> (y*imageWidth+x)*5 + 1
	// 4 -> (y*imageWidth+x)*5 + 2
	// 12 -> (y*imageWidth+x)*5 + 3
	// 8 -> (y*imageWidth+x)*5 + 4
	//
	// 15,14 -> 4,8 of pixel x-1,y
	// 2,3 -> 12,8 of pixel x,y-1
	// 5 -> 1 of pixel x+1,y
	// ...

	const voronoiVertexIndex_to_globallyUniqueIndex = {
		1: (x, y) =>  `${x},${y},1`, //(y*(imgWidth+1)+x)*5 + 0,
		0: (x, y) =>  `${x},${y},0`, //(y*(imgWidth+1)+x)*5 + 1,
		4: (x, y) =>  `${x},${y},4`, //(y*(imgWidth+1)+x)*5 + 2,
		12: (x, y) => `${x},${y},12`, //(y*(imgWidth+1)+x)*5 + 3,
		8: (x, y) =>  `${x},${y},8`, //(y*(imgWidth+1)+x)*5 + 4,
	}

	voronoiVertexIndex_to_globallyUniqueIndex[15] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[4](x-1,y)
	voronoiVertexIndex_to_globallyUniqueIndex[14] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[8](x-1,y)

	voronoiVertexIndex_to_globallyUniqueIndex[2] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[12](x,y-1)
	voronoiVertexIndex_to_globallyUniqueIndex[3] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[8](x,y-1)

	voronoiVertexIndex_to_globallyUniqueIndex[5] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[1](x+1,y)
	voronoiVertexIndex_to_globallyUniqueIndex[6] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[0](x+1,y)
	voronoiVertexIndex_to_globallyUniqueIndex[7] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[12](x+1,y)

	voronoiVertexIndex_to_globallyUniqueIndex[13] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[1](x,y+1)
	voronoiVertexIndex_to_globallyUniqueIndex[11] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[0](x,y+1)
	voronoiVertexIndex_to_globallyUniqueIndex[10] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[4](x,y+1)

	voronoiVertexIndex_to_globallyUniqueIndex[9] = (x,y) => voronoiVertexIndex_to_globallyUniqueIndex[1](x+1,y+1)

	const globallyUniqueIndex_to_absoluteXY = (index) => {
		// var voronoiVertexIndex = index % 5
		// var pixelIndex = Math.floor(index/5)
		// var pixelX  = pixelIndex % (imgWidth+1)
		// var pixelY  = Math.floor(pixelIndex / (imgWidth+1))

		var components = index.split(",")
		var pixelX     = parseInt(components[0])
		var pixelY     = parseInt(components[1])
		var voronoiVertexIndex = parseInt(components[2])

		const offsets = {
			1:  [0,    0   ],
			0:  [0.25, 0.25],
			4:  [0.75, 0.25],
			12: [0.25, 0.75],
			8:  [0.75, 0.75],
		}

		return [pixelX+offsets[voronoiVertexIndex][0], pixelY+offsets[voronoiVertexIndex][1]]
	}

	// then, once I have the adjacency list, any key that has a list of length 3 or more is a place where at least two splines meet. I can resolve these directly in the adjacency list
	// I can iterate over each point in the list, building the splines from there


	// TODO: bug - all cells are saying that their voronoiVertex 1 is connected to their neighbor [x][y+1] 's voronoi vertex 1

	var adjacencyList = {}
	for (var x = 0; x < imgWidth; x++) {	
		for (var y = 0; y < imgHeight; y++) {
			var thisPixelVoronoiVerts = [...voronoiVerts[x][y], voronoiVerts[x][y][0]].map(vert => voronoiVertexIndex_to_globallyUniqueIndex[vert](x, y))

			for (var q = 0; q < nextNeighbors.length; q++) { // we'll only consider neighbors 0, 1, 2, and 3 in order to prevent duplicates. the pixels before this one will have 7 covered, and the pixels below will cover 4, 5, and 6
				var i = nextNeighbors[q]
				if (similarityGraph[x][y][i]) continue;

				var neighborX = x+deltas[i][0]
				var neighborY = y+deltas[i][1]
				if (neighborX < 0 || neighborX >= imgWidth || neighborY < 0 || neighborY >= imgHeight) continue

				var neighborVerts = voronoiVerts[neighborX][neighborY]
				var neighborVerts = [...neighborVerts].map(vert => voronoiVertexIndex_to_globallyUniqueIndex[vert](neighborX, neighborY))
				for (var i = 0; i < thisPixelVoronoiVerts.length-1; i++) {
					var globalIndex0 = thisPixelVoronoiVerts[i]
					var globalIndex1 = thisPixelVoronoiVerts[i+1]

					try { 
						var idx = neighborVerts.indexOf(globalIndex0) 
						if (idx === -1) continue
						var idxMinus1 = idx === 0 ? neighborVerts.length-1 : idx-1
						var idxPlus1 = idx === neighborVerts.length-1 ? 0 : idx+1
						var edgeIsShared = false
						if (neighborVerts[idxPlus1] == globalIndex1 || neighborVerts[idxMinus1] == globalIndex1) edgeIsShared = true

						if (!edgeIsShared) continue
					} catch { continue }

					if (!adjacencyList[globalIndex0]) adjacencyList[globalIndex0] = [globalIndex1]
					if (!adjacencyList[globalIndex1]) adjacencyList[globalIndex1] = [globalIndex0]

					if (!adjacencyList[globalIndex0].includes(globalIndex1)) adjacencyList[globalIndex0].push(globalIndex1)
					if (!adjacencyList[globalIndex1].includes(globalIndex0)) adjacencyList[globalIndex1].push(globalIndex0)
				}


				// // let's just define a list of edges for each neighbor
				// for (var k = 0; k < possibleEdgesSharedWithNeighbor[i].length; k++) {
				// 	var edge = possibleEdgesSharedWithNeighbor[i][k]
				// 	//var edgeVerticesAbsolutePositions = edge.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])

				// 	var edgeStartIndex = thisPixelVoronoiVerts.indexOf(edge[0])
				// 	if (edgeStartIndex >= 0 && thisPixelVoronoiVerts[edgeStartIndex+1] === edge[1]) { // if this voronoi cell has the edge's first vertex and then the edges next vertex is adjacent, this cell has this edge
				// 		var globalIndex0 = voronoiVertexIndex_to_globallyUniqueIndex[edge[0]](x, y)
				// 		var globalIndex1 = voronoiVertexIndex_to_globallyUniqueIndex[edge[1]](x, y)

				// 		if (!adjacencyList[globalIndex0]) adjacencyList[globalIndex0] = []
				// 		if (!adjacencyList[globalIndex1]) adjacencyList[globalIndex1] = []

				// 		if (!adjacencyList[globalIndex0].includes(globalIndex1)) adjacencyList[globalIndex0].push(globalIndex1)
				// 		if (!adjacencyList[globalIndex1].includes(globalIndex0)) adjacencyList[globalIndex1].push(globalIndex0)
				// 	}
				// }
			}
		}
	}

	// for now the spline resolution is just "first come, first served"
	var splines = []
	var visited = {}
	var splinesByConstituents = {}
	Object.keys(adjacencyList).forEach(globalVoronoiVertexIndex => {
		//globalVoronoiVertexIndex = parseInt(globalVoronoiVertexIndex)
		if (visited[globalVoronoiVertexIndex]) return;
		var thisVisited = {}
		var spline = []

		var current = globalVoronoiVertexIndex
		while (!visited[current]) {
			if (!current) break
			
			visited[current] = true
			thisVisited[current] = true
			spline.push(current)
			splinesByConstituents[current] = spline

			var prev = current

			current = adjacencyList[current].filter(index => !thisVisited[index])[0] // first come first served
			
			if (visited[current]) {
				//attempt to join this spline and the spline that current was first visited by
				var shouldJoin = true  // this is where the "3 partial splines meet" resolution should happen
				if (shouldJoin) {
					var otherSpline = splinesByConstituents[current]

					if (otherSpline[otherSpline.length-1] == spline[0]) {
						otherSpline.concat(spline.slice(1, spline.length))
					} else if (otherSpline[otherSpline.length-1] == spline[spline.length-1]) {
						otherSpline.concat(spline.reverse().slice(1, spline.length))
					} else if (otherSpline[0] == spline[spline.length-1]) {
						spline.slice(0, spline.length-2).forEach(p => otherSpline.unshift(p))
					} else if (otherSpline[0] == spline[0]) {
						spline.slice(1, spline.length-1).reverse().forEach(p => otherSpline.unshift(p))
					}

					return; // we've run up against another spline segment, and it's already gone as far as it can, so there's nothing else to add from here
				}
			}

			if (current == undefined) 
			{
				// if all neighbors have been visited, maybe one of the neighbors is the start node, and this edge is trying to be the end of a closed loop?
				var backToStart = adjacencyList[prev].filter(index => index === spline[0])[0]
				if (backToStart) spline.push(backToStart)
			}
		}

		if (spline.length <= 2) return;

		splines.push(spline)
	});


	// draw splines
	// uses the Tangussan implementation
	var splinesCanvas = document.createElement('canvas');
	imgWidth = splinesCanvas.width = imgWidth*pixelSize;
	imgHeight = splinesCanvas.height = imgHeight*pixelSize;
	console.log(`${imgHeight*pixelSize} x ${imgWidth*pixelSize}`)
	document.body.appendChild(splinesCanvas);

	// function from https://github.com/Tagussan/BSpline/blob/master/main.js
	function drawSpline(pts, ctx, canv, degree){
		console.log(pts)

		//ctx.clearRect(0,0,canv.width,canv.height);
		if(pts.length == 0) {
			return;
		}
		for(var i = 0;i<pts.length;i++){
			ctx.fillStyle = "rgba(0,255,0,1)";
			ctx.beginPath();
			ctx.arc(pts[i][0],pts[i][1],5,0,Math.PI*2,false);
			ctx.fill();
			ctx.closePath();   
		}
		var spline = new BSpline(pts,degree,true);
		ctx.beginPath();
		var oldx,oldy,x,y;
		oldx = spline.calcAt(0)[0];
		oldy = spline.calcAt(0)[1];
		for(var t = 0;t <= 1;t+=0.001){
			ctx.moveTo(oldx,oldy);
			var interpol = spline.calcAt(t);
			x = interpol[0];
			y = interpol[1];
			ctx.lineTo(x,y);
			oldx = x;
			oldy = y;
		}
		ctx.stroke();
		ctx.closePath();
	}

	splines.forEach(splinePointIndexes => {
		var absolutePoints = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i))
		var absolutePoints_scaled = absolutePoints.map(point => [pixelSize*point[0], pixelSize*point[1]])
		drawSpline(absolutePoints_scaled, splinesCanvas.getContext('2d'), splinesCanvas, 2)
	})

	// draw splines approximation (SVG)
	var splinesSvg = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	
	// draw all adjacencies (this highlights edges that were missed when building splines)
	Object.keys(adjacencyList).forEach(globalPointIndex => {
		var point = globallyUniqueIndex_to_absoluteXY(globalPointIndex).map(x_or_y => pixelSize*x_or_y)
		var points = adjacencyList[globalPointIndex].map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
		for(var i = 0; i < points.length; i++) {
				var color = [Math.floor(Math.random()*150)+50, Math.floor(Math.random()*150)+50, Math.floor(Math.random()*150)+50]
				makeLine(splinesSvg, ...point, ...points[i], color)
		}
	})
	
	// draw splines approximation
	splines.forEach(splinePointIndexes => {
		var color = [Math.floor(Math.random()*150)+50, Math.floor(Math.random()*150)+50, Math.floor(Math.random()*150)+50]
		var points = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
		for(var i = 0; i < points.length-1; i++) {
			makeLine(splinesSvg, ...points[i], ...points[i+1]) //, color)
		}
	})
	
	//
	// smoothen splines
	//

	const POSITOINAL_ENERGY_WEIGHT = 1

	function energyCurvature(points, index) {
		// hopefully the transpiled code will work
	}

	function energyPosition(originalPoint, point) {
		return [Math.pow(Math.abs(point[0]-originalPoint[0]), 4), 
				Math.pow(Math.abs(point[1]-originalPoint[1]), 4)]
	}
}

//window.onload = preinit;