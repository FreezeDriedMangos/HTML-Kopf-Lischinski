
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
	
	function veryDissimilarColors(yuv1, yuv2) {
		if (yuv1[3] !== undefined || yuv2[3] !== undefined) // if they have alpha components
			if ((yuv1[3] === 0) !== (yuv2[3] === 0)) return true; // if one is completely transparent and the other is not, the pixels are automatically considered dissimilar

		var dy = Math.abs(yuv1[0]-yuv2[0]) > 100;
		var du = Math.abs(yuv1[1]-yuv2[1]) > 100;
		var dv = Math.abs(yuv1[2]-yuv2[2]) > 100;
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


	
	// fix corners where 3 or 4 dissimilar colors meet	
	var tempConnections = []
	// function connectSimilarNeighbors(x, y, similarTo) {
	// 	for (var i = 1; i < 8; i += 2) {
	// 		delta = deltas[i]
	// 		var nX = x + delta[0] // neighbor we may be adding connections to
	// 		var nY = y + delta[1]

	// 		if (dissimilarColors(similarTo, yuvImage[nX][nY])) continue
	// 		if (!similarityGraph[x][y][i]) tempConnections.push([x, y, i])
	// 		similarityGraph[x][y][i] = true

	// 		var neighborRelativeI = (i+4)%8
	// 		if (!similarityGraph[nX][nY][neighborRelativeI]) tempConnections.push([nX, nY, neighborRelativeI])
	// 		similarityGraph[nX][nY][neighborRelativeI] = true
	// 	}
	// }
	// function addTempConnection(x, y, toNeighbor) {
	// 	// console.log({x, y, toNeighbor, similar:similarityGraph[x][y][toNeighbor]})
	// 	// if (!similarityGraph[x][y][toNeighbor]) tempConnections.push([x, y, toNeighbor])
	// 	// similarityGraph[x][y][toNeighbor] = true

	// 	var delta = deltas[toNeighbor] // neighbor we're connecting to
	// 	var newX = x + delta[0]
	// 	var newY = y + delta[1]

	// 	// var neighborRelative = (toNeighbor+4)%8
	// 	// if (!similarityGraph[newX][newY][neighborRelative]) tempConnections.push([newX, newY, neighborRelative])
	// 	// similarityGraph[newX][newY][neighborRelative] = true
		
	// 	// also add connections to all orthogonal neighbors that are similar to `toNeighbor`
	// 	connectSimilarNeighbors(x, y, yuvImage[newX][newY])
	// 	connectSimilarNeighbors(newX, newY, yuvImage[x][y])
	// }

	// for (var x = 0; x < imgWidth-1; x++) {
	// 	for (var y = 0; y < imgHeight-1; y++) {
	// 		var dissimilars = []
			
	// 		if (!dissimilarColors(yuvImage[x][y], yuvImage[x+1][y+1]) || !dissimilarColors(yuvImage[x+1][y], yuvImage[x][y+1])) continue; // don't cross connected diagonals

	// 		if (dissimilarColors(yuvImage[x][y], yuvImage[x+1][y])  ) dissimilars.push(yuvImage[x+1][y]  )	
	// 		if (dissimilarColors(yuvImage[x][y], yuvImage[x][y+1])  ) dissimilars.push(yuvImage[x][y+1]  )	
	// 		if (dissimilarColors(yuvImage[x][y], yuvImage[x+1][y+1])) dissimilars.push(yuvImage[x+1][y+1])		

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

	// 		if (atLeastThreeDissimilars) {
				
	// 			// 0 1 2
	// 			// 7 # 3
	// 			// 6 5 4
	// 			addTempConnection(x+1, y  , 7)
	// 			addTempConnection(x  , y  , 5)
	// 			addTempConnection(x  , y  , 3)
	// 			addTempConnection(x  , y+1, 1)
	// 			addTempConnection(x+1, y+1, 7)
	// 			addTempConnection(x  , y+1, 3)
	// 			addTempConnection(x+1, y+1, 1)
	// 			addTempConnection(x+1, y  , 5)
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
	const HEAL_3_COLOR_MEETINGS = true; // TODO: alternate healing where only certain patterns are changed, and they're changed according to their neighbors
	// better healing: pick one of the four involved corners to explode
	// pick the corner with the fewest connections, breaking ties by the angle (eg an acute angle beats a right angle beats a straight line) (11 beats 101/0101 beats 1001 beats 10001)
	// then, on the exploding corner, find the vertex not shared by any of the four involved pixels. mark this index.
	// moving clockwise, check each of the four pixels. check each vertex in a counter clockwise order, and when you find a vertex not shared by at least 2 other pixels, append it vertex to a list
	// finally, replace the exploding corner's marked index with the created list
	// NOTE: to do this, I would need to have already converted the voronoi indices to globally unique indices at this point
	if (HEAL_3_COLOR_MEETINGS) {
		for (var x = 0; x < imgWidth-1; x++) {
			for (var y = 0; y < imgHeight-1; y++) {
				if (!dissimilarColors(yuvImage[x][y], yuvImage[x+1][y+1]) || !dissimilarColors(yuvImage[x+1][y], yuvImage[x][y+1])) continue; // don't cross connected diagonals

				var dissimilars = []
				// ignore transparent pixels
				if (dissimilarColors(yuvImage[x][y], yuvImage[x+1][y])  ) dissimilars.push(yuvImage[x+1][y]  )	
				if (dissimilarColors(yuvImage[x][y], yuvImage[x][y+1])  ) dissimilars.push(yuvImage[x][y+1]  )	
				if (dissimilarColors(yuvImage[x][y], yuvImage[x+1][y+1])) dissimilars.push(yuvImage[x+1][y+1])		

				var atLeastThreeDissimilars = false
				while(dissimilars.length > 0) {
					var testColor = dissimilars.pop()
					for (var i = 0; i < dissimilars.length; i++) {
						if (dissimilarColors(testColor, dissimilars[i])) {
							atLeastThreeDissimilars = true
							break
						}
					}

					if (atLeastThreeDissimilars) break
				}

				if (atLeastThreeDissimilars) {
					// if any of these four pixels have an inset corner, pop that corner back out
					voronoiVerts[x][y]     = [...voronoiVerts[x][y]];
					voronoiVerts[x+1][y]   = [...voronoiVerts[x+1][y]];
					voronoiVerts[x][y+1]   = [...voronoiVerts[x][y+1]];
					voronoiVerts[x+1][y+1] = [...voronoiVerts[x+1][y+1]];
					replaceElement(voronoiVerts[x][y],     8,  9) 
					replaceElement(voronoiVerts[x+1][y],   12, 13) 
					replaceElement(voronoiVerts[x][y+1],   4,  5) 
					replaceElement(voronoiVerts[x+1][y+1], 0,  1) 
				}
			}
		}
	}

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

	tempConnections.forEach(([x, y, neightborIndex]) => {
		console.log({x,y,neightborIndex})
		var delta = deltas[neightborIndex]
		var newX = x + delta[0]
		var newY = y + delta[1]
		makeLine(voronoiSVG, x*pixelSize+pixelSize/2, y*pixelSize+pixelSize/2, newX*pixelSize+pixelSize/2, newY*pixelSize+pixelSize/2, [255, 0, 0])
	})

	// revert temporary connections
	tempConnections.forEach(([x, y, neightborIndex]) => similarityGraph[x][y][neightborIndex] = false)


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
		1: (x, y) =>  `${x},${y},1`, 
		0: (x, y) =>  `${x},${y},0`, 
		4: (x, y) =>  `${x},${y},4`, 
		12: (x, y) => `${x},${y},12`,
		8: (x, y) =>  `${x},${y},8`, 
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


	// iterate over each pixel and check each of its neighbors for dissimilar pixels
	// when a pair of dissimilar pixels is found, record any edges that they share. these edges will eventually be stitched together into the splines
	var pointsThatArePartOfContouringSplines = {}
	var adjacencyList = {}
	for (var x = 0; x < imgWidth; x++) {	
		for (var y = 0; y < imgHeight; y++) {
			var thisPixelVoronoiVerts = [...voronoiVerts[x][y], voronoiVerts[x][y][0]].map(vert => voronoiVertexIndex_to_globallyUniqueIndex[vert](x, y))

			for (var q = 0; q < nextNeighbors.length; q++) { // we'll only consider neighbors 0, 1, 2, and 3 in order to prevent duplicates. the pixels before this one will have 7 covered, and the pixels below will cover 4, 5, and 6
				var i = nextNeighbors[q]
				if (similarityGraph[x][y][i]) continue; // no splines exist on the boundries of similar pixels

				var neighborX = x+deltas[i][0]
				var neighborY = y+deltas[i][1]
				if (neighborX < 0 || neighborX >= imgWidth || neighborY < 0 || neighborY >= imgHeight) continue

				// iterate over all of this pixels voronoi vertices (in global index form, rather than in pixel-relative index form)
				var neighborVerts = voronoiVerts[neighborX][neighborY]
				var neighborVerts = [...neighborVerts].map(vert => voronoiVertexIndex_to_globallyUniqueIndex[vert](neighborX, neighborY))
				for (var i = 0; i < thisPixelVoronoiVerts.length-1; i++) {
					var globalIndex0 = thisPixelVoronoiVerts[i]
					var globalIndex1 = thisPixelVoronoiVerts[i+1]

					// check to see if this neighbor has edge (globalIndex0, globalIndex1)
					try { 
						var idx = neighborVerts.indexOf(globalIndex0) 
						if (idx === -1) continue
						var idxMinus1 = idx === 0 ? neighborVerts.length-1 : idx-1
						var idxPlus1 = idx === neighborVerts.length-1 ? 0 : idx+1
						var edgeIsShared = false
						if (neighborVerts[idxPlus1] == globalIndex1 || neighborVerts[idxMinus1] == globalIndex1) edgeIsShared = true

						if (!edgeIsShared) continue
					} catch { continue }

					// the two dissimilar pixels do share this edge, so add this edge to the adjacency list
					if (!adjacencyList[globalIndex0]) adjacencyList[globalIndex0] = []
					if (!adjacencyList[globalIndex1]) adjacencyList[globalIndex1] = []

					if (!adjacencyList[globalIndex0].includes(globalIndex1)) adjacencyList[globalIndex0].push(globalIndex1)
					if (!adjacencyList[globalIndex1].includes(globalIndex0)) adjacencyList[globalIndex1].push(globalIndex0)

					// for later, cache whether this edge will eventually be part of a "contour" spline. that is, a spline that separates two VERY dissimilar colors
					if (veryDissimilarColors(yuvImage[x][y], yuvImage[neighborX][neighborY])) {
						pointsThatArePartOfContouringSplines[globalIndex0] = true
						pointsThatArePartOfContouringSplines[globalIndex1] = true
					}
				}
			}
		}
	}


	var splines = []
	var valence3Nodes = Object.keys(adjacencyList).filter(point => adjacencyList[point].length >= 3)
	var valence2Nodes = Object.keys(adjacencyList).filter(point => adjacencyList[point].length < 3)
	var splinesByConstituents = {}
	valence2Nodes.forEach(point => {
		if (splinesByConstituents[point]) return // this point has already been visited and added to a spline

		// step 1: look forward until a valence1 node is found (straight line) or until point is found again (closed loop)
		var current = point
		var prev = point
		while (adjacencyList[current].length === 2) {
			var next = adjacencyList[current].filter(neighborPoint => neighborPoint != prev && adjacencyList[neighborPoint].length <= 2)[0] // only consider valence 2 neighbors that aren't the current
			if (next == undefined) break; // we've hit a valence 2 node whose only neighbors are current and a valence 3-4 node, so this is the end of the line
			prev = current
			current = next
			if (current == point) break; // we've looped back to the start, only hitting valence 2 nodes along the way - this is a simple closed loop
		}

		const loopStart = current

		// step 2: grow this spline starting from the new start point (current)
		var spline = []
		prev = current
		while(current != undefined) {
			splinesByConstituents[current] = spline; // mark this point as belonging to a spline
			spline.push(current)
			var next = adjacencyList[current].filter(neighborPoint => neighborPoint != prev && adjacencyList[neighborPoint].length <= 2)[0]
			prev = current
			current = next
			if (current === loopStart) { spline.push(point); break; } // close the looped spline and then break
		}
		

		splines.push(spline)
	})

	// helper function from https://stackoverflow.com/a/53107778/9643841
	const pairsOfArray = array => (
		array.reduce((acc, val, i1) => [
		  ...acc,
		  ...new Array(array.length - 1 - i1).fill(0)
			.map((v, i2) => ([array[i1], array[i1 + 1 + i2]]))
		], [])
	  ) 

	// step 3: deal with all the valence3 nodes
	valence3Nodes.forEach(point => {
		// this is where 3 spline meetings are resolved
		var allConnectedSplines = adjacencyList[point].map(neighborPoint => splinesByConstituents[neighborPoint])
		var joinSpline0 = null //splinesByConstituents[adjacencyList[point][0]]
		var joinSpline1 = null //splinesByConstituents[adjacencyList[point][1]]

		// var allSplinePairs = pairsOfArray(allConnectedSplines)
		// try to prioritize connecting splines that separate very dissimilar colors (contouring splines)
		var countourSplineEndpoints = adjacencyList[point].filter(neighborPoint => pointsThatArePartOfContouringSplines[neighborPoint])
		var shadingSplineEndpoints  = adjacencyList[point].filter(neighborPoint => !pointsThatArePartOfContouringSplines[neighborPoint])
		var pairsToConsiderJoining = []

		if (countourSplineEndpoints.length == 2) {
			pairsToConsiderJoining = [countourSplineEndpoints[0], countourSplineEndpoints[1]]
		} else if (countourSplineEndpoints.length == 1) {
			shadingSplineEndpoints.forEach(splinePoint => pairsToConsiderJoining.push([countourSplineEndpoints[0], splinePoint]))
		} else {
			if (countourSplineEndpoints.length <= 0) pairsToConsiderJoining = pairsOfArray(shadingSplineEndpoints)
			if (countourSplineEndpoints.length >= 3) pairsToConsiderJoining = pairsOfArray(countourSplineEndpoints)
		}

		// out of the pairs we're considering, pick the one forms the smallest angle with `point` as the centerpoint
		var bestPair = pairsToConsiderJoining[0]
		var bestAngle = 9999
		pairsToConsiderJoining.forEach(([p0, p1]) => {
			function cartesianToRelativePolarTheta(x, y) {
				return Math.atan2(y-point[1] , x-point[0])
			}

			var theta0 = cartesianToRelativePolarTheta(...p0)
			var theta1 = cartesianToRelativePolarTheta(...p1)
			var angle = Math.abs(theta0-theta1)

			if (angle < bestAngle) {
				bestAngle = angle
				bestPair = [p0, p1]
			}
		})

		// we've got our points! convert them to splines
		joinSpline0 = splinesByConstituents[bestPair[0]]
		joinSpline1 = splinesByConstituents[bestPair[1]]

		// add self to all adjacent splines (whether a spline gets joined with another or just terminates, this has to happen anyway)
		allConnectedSplines.forEach(spline => {
			if (adjacencyList[point].includes(spline[0])) spline.unshift(point) // this point is adjacent to the start of the spline
			else if (adjacencyList[point].includes(spline[spline.length-1])) spline.push(point) // this point is adjacent to the end of the spline
			else { console.error("attempted to add a point to a non-adjacent spline"); console.log(adjacencyList[point]); console.log(spline) }
		})

		if (joinSpline0 == joinSpline1) {
			// we made a loop that contained at least 1 valence3orGreater node
			joinSpline0.unshift(point)
			joinSpline0.push(point)
			return
		}

		// construct a new spline made by laying the two "to join" splines together end-to-end (and being careful not to introduce any duplicates)
		var newSpline = []
		if (joinSpline0[0] == joinSpline1[0]) {

			newSpline = [...joinSpline0, ...joinSpline1.slice(1, joinSpline1.length).reverse()]

		} else if (joinSpline0[0] == joinSpline1[joinSpline1.length-1]) {
			
			newSpline = [...joinSpline1, ...joinSpline0.slice(1, joinSpline0.length)]

		} else if (joinSpline0[joinSpline0.length-1] == joinSpline1[0]) {
			
			newSpline = [...joinSpline0, ...joinSpline1.slice(1, joinSpline1.length)]

		} else if (joinSpline0[joinSpline0.length-1] == joinSpline1[joinSpline1.length-1]) {
			
			newSpline = [...joinSpline0, ...joinSpline1.reverse().slice(1, joinSpline1.length)]

		}

		// we dissolved the old splines, so we need to update everywhere it's referenced
		joinSpline0.forEach(constituent => splinesByConstituents[constituent] = newSpline)
		splines.splice(splines.indexOf(joinSpline0), 1) // js arrays have no remove function, so I gotta do this
		joinSpline1.forEach(constituent => splinesByConstituents[constituent] = newSpline)
		splines.splice(splines.indexOf(joinSpline1), 1) // js arrays have no remove function, so I gotta do this

		splines.push(newSpline)
	})
	
	// draw splines approximation (SVG)
	// this will help me see if the splines were generated correctly
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
			//makeSquare(splinesSvg, ...points[i], pixelSize/3, color)
			makeLine(splinesSvg, ...points[i], ...points[i+1]) //, color)
		}
	})

	// draw splines
	var splinesCanvas = document.createElement('canvas');
	imgWidth = splinesCanvas.width = imgWidth*pixelSize;
	imgHeight = splinesCanvas.height = imgHeight*pixelSize;
	document.body.appendChild(splinesCanvas);

	splines.forEach(splinePointIndexes => {
		var absolutePoints = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i))
		var absolutePoints_scaled = absolutePoints.map(point => [pixelSize*point[0], pixelSize*point[1]])
		
		const splineObject = new ClampedClosedBSpline(4, absolutePoints_scaled)
		splineObject.drawToCanvas(splinesCanvas.getContext('2d'))
	})

	return;
	
	//
	// smoothen splines
	//


	const POSITOINAL_ENERGY_WEIGHT = 1
	const MAX_RANDOM_OFFSET = 0.05
	const CURVATURE_INTEGRAL_INTERVALS_PER_SPAN = 20
	const NUM_OPTOMIZATION_GUESSES_PER_POINT = 20
	const SPLINE_DEGREE = 4 // must be at least 3

	const splineObjects = splines.map(splinePointIndexes => {
		var absolutePoints = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i))
		var absolutePoints_scaled = absolutePoints.map(point => [pixelSize*point[0], pixelSize*point[1]])
		return new ClampedClosedBSpline(SPLINE_DEGREE, absolutePoints_scaled)
	})

	function energyCurvature(spline, index) {
		return spline.IntegrateCurvature(index, CURVATURE_INTEGRAL_INTERVALS_PER_SPAN)
	}

	function energyPosition(originalPoint, point) {
		return [Math.pow(Math.abs(point[0]-originalPoint[0]), 4), 
				Math.pow(Math.abs(point[1]-originalPoint[1]), 4)]
	}

	function pointEnergy(spline, index, originalPoint) {
		return energyCurvature(spline, index) + 
			POSITOINAL_ENERGY_WEIGHT*energyPosition(originalPoint, index)
	}

	function randomPointOffset(point) {
		var r = Math.random()*MAX_RANDOM_OFFSET
		var a = Math.random()*2*Math.PI
		return [r*Math.cos(a)+point[0],
				r*Math.sin(a)+point[1]]
	}

	splineObjects.forEach(splineObject => {
		splineObject.points.forEach((point, index) => {
			//# The function which is used to optimize the position of a point
			const start = [...splineObject.points[index]]
			const energies = []
			energies.push([, start])
			var bestEnergy = pointEnergy(splineObject, index, start)
			var bestEnergy_point = start

			for(var i = 0; i < NUM_OPTOMIZATION_GUESSES_PER_POINT; i++) { // Around 20 guesses are made and the minimum energy one is chosen
				point = randomPointOffset(start)
				splineObject.points[index] = point
				const thisEnergy = pointEnergy(splineObject, index, start)
				if (thisEnergy < bestEnergy) {
					bestEnergy = thisEnergy
					bestEnergy_point = point
				}
			}

			splineObject.points[index] = point
		})
	})

	
	// draw smoothened splines
	var smoothedSplinesCanvas = document.createElement('canvas');
	imgWidth = smoothedSplinesCanvas.width = imgWidth*pixelSize;
	imgHeight = smoothedSplinesCanvas.height = imgHeight*pixelSize;
	document.body.appendChild(smoothedSplinesCanvas);

	splineObjects.forEach(splineObject => {
		splineObject.drawToCanvas(smoothedSplinesCanvas.getContext('2d'))
	})
}

//window.onload = preinit;