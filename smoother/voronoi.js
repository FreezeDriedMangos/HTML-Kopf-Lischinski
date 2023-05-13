

// voronoi constants
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

	"00100101": [1, 3, 6, 9, 13],

	// 4 connections
	"01100011": [1, 5, 6, 8, 11, 13], 
	"01010011": [1, 5, 9, 11, 13],
	"00110011": [1, 3, 5, 9, 11, 13],
	"00011011": [1, 5, 9, 10, 11, 13], 
	"01010101": [1, 5, 9, 13],
	"00101011": [1, 3, 5, 6, 7, 9, 10, 11, 13], // unsure
	"10101010": [2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 1],

	"10010110": [2, 5, 9, 13, 14, 15],

	// "11100010": [1, 2, 3, 5, 6, 8, 11, 13, 14, 15], 
	"11100010": [1, 5, 6, 8, 11, 13, 14, 15], 
	
	// "10100011": [], 
	
	// 0 1 2
	// 7   3
	// 6 5 4

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

	"01001110": [1, 5, 7, 9, 13, 14], 

	// 5 connections
	"10110101": [1, 2, 3, 5, 9, 13],
	"11100110": [1, 5, 6, 9, 13, 14, 15],
	
	"01010111": [1, 5, 9, 13], 
	"01100111": [1, 5, 6, 9, 13],

	"10101011": [1, 2, 3, 6, 7, 10, 11, 13],

	"10110110": [14, 15, 2, 3, 5, 9, 13],

	// 6 connections
	"10111011": [1, 2, 3, 5, 9, 10, 11, 13],
	
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
function computeLocalVoronoiVertsPerPixel(similarityGraph, imgWidth, imgHeight) {
	
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
	// each pixel will be converted into some polygon. but because of the rules of this conversion, (and some other outside factors, such as no lines crossing, pixels being perfectly aligned to grid, etc)
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

	return {
		voronoiVerts
	}
}


function heal3ColorMeetings(voronoiVerts, yuvImage, imgWidth, imgHeight) {
	
	function replaceElement(array, elem, newElem) {
		try { array[array.indexOf(elem)] = newElem } 
		catch { return false }
		return true
	}

	// better healing: pick one of the four involved corners to explode
	// pick the corner with the fewest connections, breaking ties by the angle (eg an acute angle beats a right angle beats a straight line) (11 beats 101/0101 beats 1001 beats 10001)
	// then, on the exploding corner, find the vertex not shared by any of the four involved pixels. mark this index.
	// moving clockwise, check each of the four pixels. check each vertex in a counter clockwise order, and when you find a vertex not shared by at least 2 other pixels, append it vertex to a list
	// finally, replace the exploding corner's marked index with the created list
	// NOTE: to do this, I would need to have already converted the voronoi indices to globally unique indices at this point

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

