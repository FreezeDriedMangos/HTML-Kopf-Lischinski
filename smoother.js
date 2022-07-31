
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
		"00100000": [0, 3, 6, 8, 12],

		// 2 connections
		"00010100": [0, 5, 9, 13],
		"00100100": [0, 3, 6, 9, 13],
		"00100010": [14, 0, 3, 6, 8, 11],
		"00010001": [1, 5, 9, 13], // is this right?
		"00001010": [0, 4, 7, 10, 11, 14],
		"01100000": [1, 5, 6, 8, 12], // unsure

		// 3 connections
		"01100100": [1, 5, 6, 9, 13],
		"00110010": [3, 5, 9, 11, 14],
		"01100001": [1, 5, 6, 8, 13], // unsure
		"01000101": [1, 5, 9, 13],

		"00001110": [0, 4, 7, 9, 13, 14], 
		"00011010": [0, 5, 9, 10, 11, 14],

		"01001010": [1, 5, 7, 10, 11, 14],
		"10100010": [15, 2, 3, 6, 11, 14],

		// 4 connections
		"01100011": [1, 5, 6, 11, 13], 
		"01010011": [1, 5, 9, 11, 13],
		"00110011": [1, 3, 5, 9, 11, 13],
		"00011011": [1, 5, 9, 10, 11, 13], 
		"01010101": [1, 5, 9, 13],
		"00101011": [1, 3, 6, 7, 10, 11, 13], // unsure
		"10101010": [2, 3, 6, 7, 10, 11, 14, 15],

		"11100010": [1, 2, 3, 6, 11, 14, 15], 

		// 5 connections
		"10110101": [1, 2, 3, 5, 9, 13],
		"11100110": [1, 5, 6, 9, 13, 14, 15]
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
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])); continue }

			patternTest = bitstringTransform_90deg(patternBitstring)
			thisVoronoiVerts = voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(connectionPatterns_toVoronoiVerts[patternTest]))) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])); continue }

			patternTest = bitstringTransform_90deg(bitstringTransform_90deg(patternBitstring))
			thisVoronoiVerts = voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(connectionPatterns_toVoronoiVerts[patternTest])) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])); continue }

			patternTest = bitstringTransform_90deg(bitstringTransform_90deg(bitstringTransform_90deg(patternBitstring)))
			thisVoronoiVerts = voronoiVertsTransform_90deg(connectionPatterns_toVoronoiVerts[patternTest]) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])); continue }
			
			// test mirrored
			
			var patternTest = bitstringTransform_mirror(patternBitstring)
			var thisVoronoiVerts = voronoiVertsTransform_mirror(connectionPatterns_toVoronoiVerts[patternTest])
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])); continue }

			patternTest = bitstringTransform_mirror(bitstringTransform_90deg(patternBitstring))
			thisVoronoiVerts = voronoiVertsTransform_90deg( voronoiVertsTransform_90deg(voronoiVertsTransform_90deg(voronoiVertsTransform_mirror(connectionPatterns_toVoronoiVerts[patternTest]))) ) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])); continue }

			patternTest = bitstringTransform_mirror( bitstringTransform_90deg(bitstringTransform_90deg(patternBitstring)) )
			thisVoronoiVerts = voronoiVertsTransform_90deg( voronoiVertsTransform_90deg(voronoiVertsTransform_mirror(connectionPatterns_toVoronoiVerts[patternTest])) ) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])); continue }

			patternTest = bitstringTransform_mirror( bitstringTransform_90deg(bitstringTransform_90deg(bitstringTransform_90deg(patternBitstring))) )
			thisVoronoiVerts = voronoiVertsTransform_90deg( voronoiVertsTransform_mirror(connectionPatterns_toVoronoiVerts[patternTest]) ) // undo the rotation
			if (thisVoronoiVerts) { voronoiVerts[x][y] = (thisVoronoiVerts.map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy])); continue }
			
			// nothing found
			console.log("No pattern matched for " + patternBitstring)
		}
	}

	// draw voronoi :)
	var voronoiSVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	var skipSimilarityGraph = true;
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			makePolygon(voronoiSVG, voronoiVerts[x][y].map(([x, y]) => [pixelSize*x, pixelSize*y]), rgbToHex(...getPixelData(x, y)))

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

	//
	// smoothen splines
	//
}

//window.onload = preinit;