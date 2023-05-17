

// How does this spline generation work?
// The voronoi function produces a list of local voronoi vertices for each pixel
// The first part of the spline building step is to convert all those local vertices to globally unique strings called "indexes" such that if any pixels have a vertex that overlaps with another pixel's vertex, those overlapping vertices will be converted to the same "index" string
// so basically, assign a unique number to every point on the entire pixel grid that can be a valid voronoi vertex
// then, an adjacency list of these indices is computed - any two indices are considered adjacent if they form an edge on at least one pixel's voronoi cell. every edge is actually shared by exactly two pixels. So, only the edges that are shared by dissimilar pixels are recorded

var nextNeighbors = [3, 4, 5, 6]
var previousNeighbors = [7, 0, 1, 2]

// new strategy: make a voronoiVertexIndex but for the whole pixel grid

// note: this numbering system means each pixel "owns" four points: the top left corner and the four inner points: [1, 0,4,12,8]
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


var __splinePrototypeCounter = 0

class SplinePrototype {
	constructor(points, isGhostSpline, isContouringSpline, colors) {
		this.points = points
		this.isGhostSpline = isGhostSpline
		this.isContouringSpline = isContouringSpline
		this.colors = colors // one per edge, of form [{left: [r, g, b, a], right: [r, g, b, a]}, ...]
		this.id = __splinePrototypeCounter++
	}
}

const cachedPoints = {} // we cache points so that later, if one point is moved, all other points with exactly the same [x,y] are also moved the same. in this implementation, that's desireable
const globallyUniqueIndex_to_absoluteXY = (index) => {
	// var voronoiVertexIndex = index % 5
	// var pixelIndex = Math.floor(index/5)
	// var pixelX  = pixelIndex % (imgWidth+1)
	// var pixelY  = Math.floor(pixelIndex / (imgWidth+1))

	if (cachedPoints[index]) return cachedPoints[index]

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

	const point = [pixelX+offsets[voronoiVertexIndex][0], pixelY+offsets[voronoiVertexIndex][1]]
	cachedPoints[index] = point

	return point
}

function computeSplinesByGlobalIndices(similarityGraph, voronoiVerts, yuvImage, imgWidth, imgHeight, getPixelData, buildGhostSplines=false) {
	// iterate over each pixel and check each of its neighbors for dissimilar pixels
	// when a pair of dissimilar pixels is found, record any edges that they share. these edges will eventually be stitched together into the splines

	var pointsThatArePartOfContouringSplines = {} // secondary output
	var pointsThatArePartOfGhostSplines = {} // secondary output

	var edgesThatArePartOfGhostSplines = {}
	var edgesThatArePartOfContourSplines = {}


	var edgeColors = {}


	var adjacencyList = {}
	for (var x = 0; x < imgWidth; x++) {	
		for (var y = 0; y < imgHeight; y++) {
			var thisPixelVoronoiVerts = null
			
			try {
				thisPixelVoronoiVerts = [...voronoiVerts[x][y], voronoiVerts[x][y][0]].map(vert => voronoiVertexIndex_to_globallyUniqueIndex[vert](x, y)) 
			} catch (e) {
				console.log('Voronoi vertex lookup error: ')
				console.log({vert, x, y, thisPixelVoronoiVerts, voronoiVerts})
				throw e
			}

			for (var q = 0; q < nextNeighbors.length; q++) { // we'll only consider neighbors 0, 1, 2, and 3 in order to prevent duplicates. the pixels before this one will have 7 covered, and the pixels below will cover 4, 5, and 6
				var i = nextNeighbors[q]
				if (similarityGraph[x][y][i] && !(buildGhostSplines && differentColors(yuvImage[x][y], yuvImage[x+deltas[i][0]][y+deltas[i][1]]))) continue; // no splines exist on the boundries of similar pixels, unless we're building ghost splines

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

						edgesThatArePartOfContourSplines[globalIndex0 + ' - ' + globalIndex1] = true
						edgesThatArePartOfContourSplines[globalIndex1 + ' - ' + globalIndex0] = true

					} else if (!dissimilarColors(yuvImage[x][y], yuvImage[neighborX][neighborY])){
						pointsThatArePartOfGhostSplines[globalIndex0] = true
						pointsThatArePartOfGhostSplines[globalIndex1] = true

						edgesThatArePartOfGhostSplines[globalIndex0 + ' - ' + globalIndex1] = true
						edgesThatArePartOfGhostSplines[globalIndex1 + ' - ' + globalIndex0] = true
					}

					// for later, cache the colors related to this edge
					// note: voronoi verts are always ordered clockwise, so pixel [x][y] will always be to the right of this edge, and [neighborX][neighborY] to the left
					edgeColors[globalIndex0 + ' - ' + globalIndex1] = {
						right: getPixelData(x, y),
						left: getPixelData(neighborX, neighborY)
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
		
		if (spline.length <= 0) return

		splines.push(spline)
	})

	// check for and add edges whose two vertices are both valence3-or-higher nodes (these are missed by the above steps)
	const dontDuplicate = {}
	valence3Nodes.forEach(point => {
		const valence3Neighbors = adjacencyList[point].filter(neighbor => adjacencyList[neighbor].length >= 3)
		valence3Neighbors.forEach(neighbor => {
			if (dontDuplicate[neighbor] && dontDuplicate[neighbor][point]) return

			var spline = [point, neighbor]
			splines.push(spline)

			dontDuplicate[point] = dontDuplicate[point] || {}
			dontDuplicate[point][neighbor] = true
			dontDuplicate[neighbor] = dontDuplicate[neighbor] || {}
			dontDuplicate[neighbor][point] = true

			if (!splinesByConstituents[neighbor]) splinesByConstituents[neighbor] = spline
			if (!splinesByConstituents[point])    splinesByConstituents[point]    = spline
		})

		// new code: stick this point on the end of every spline (made of valence 2 nodes) whose endpoint it's adjacent to
		const valence2Neighbors = adjacencyList[point].filter(neighbor => adjacencyList[neighbor].length < 3)
		valence2Neighbors.forEach(neighbor => {
			const spline = splinesByConstituents[neighbor]
			if (neighbor == spline[0]) spline.unshift(point)
			else if (neighbor == spline[spline.length-1]) spline.push(point)
			else console.error("point is adjacent to a valence 2 node in the middle of another spline? (impossible)")
		})
	})


	//
	// Process the collected splines
	//


	// account for splines the user has forced to have a particular state
	if (markedEdges && Object.keys(markedEdges).length) {

		var len = splines.length
		for (var i = 0; i < len; i++) {
			var splineForcedState = undefined
			var spline = splines[i]
			
			for (var j = 0; j < spline.length; j++) {
				const edge = spline[j] + ' - ' + spline[j+1]
				const inverseEdge = spline[j+1] + ' - ' + spline[j]
				const edgeMarking = markedEdges[edge] || markedEdges[inverseEdge]
				
				if (!edgeMarking) continue

				if (splineForcedState && edgeMarking.toString() !== splineForcedState.toString()) {
					// this spline was forced to be in two different states. To respect this, we must split it
					splines.push(spline.slice(j)) // I do not like that "slice" and "splice" are so similarly named - the difference between the two is very important
					spline.splice(j)
					len++
					break // don't worry, the code below will still trigger on this edge, it'll just happen when the outer loop reaches the newly added spline
				}
				
				splineForcedState = edgeMarking
			}

			if (splineForcedState) {
				for (var j = 0; j < spline.length; j++) {
					// go back and update all of the edges of the spline to match the forced edge
					const edge = spline[j] + ' - ' + spline[j+1]
					edgesThatArePartOfContourSplines[edge] = splineForcedState.isContouringSpline
					edgesThatArePartOfGhostSplines[edge] = splineForcedState.isGhostSpline
				}
			}
		}
	}


	// package splines into objects to store the points and metadata (spline type: contouring, normal, ghost) together
	const packagedSplinePrototypes = splines.map((splinePoints, splineIndex) => {
		var isGhostSpline = edgesThatArePartOfGhostSplines[splinePoints[0] + ' - ' + splinePoints[1]]
		var isContouringSpline = edgesThatArePartOfContourSplines[splinePoints[0] + ' - ' + splinePoints[1]]

		var colors = []

		for(var i = 0; i < splinePoints.length-1; i++) {
			const edge = splinePoints[i] + ' - ' + splinePoints[i+1]

			colors.push(edgeColors[edge])

			if (edgesThatArePartOfGhostSplines[edge] != isGhostSpline) {
				console.log({edgesThatArePartOfGhostSplines, splinePoints, splineIndex, i})
				throw Error("Spline is partly ghost spline, partly not")
			}
			if (edgesThatArePartOfContourSplines[edge] != isContouringSpline) {
				console.log({edgesThatArePartOfContourSplines, splinePoints, splineIndex, i})
				throw Error("Spline is partly contour spline, partly not")
			}

			if (isGhostSpline && isContouringSpline) {
				console.log({edgesThatArePartOfContourSplines, edgesThatArePartOfGhostSplines, splinePoints, splineIndex, i})
				throw Error("Spline is both contour and ghost spline")
			}
		}
		return new SplinePrototype(splinePoints, isGhostSpline, isContouringSpline, colors)
	})




	
	return {
		packagedSplinePrototypes,

		splines,
		splinesByConstituents,
		adjacencyList,
		pointsThatArePartOfContouringSplines,
		pointsThatArePartOfGhostSplines,
	}


	//
	// TODO: rewrite the "join splines where they meet at valence 3/4 nodes" code
	//
}








function computeSplinesByGlobalIndices_EDGE_METHOD(similarityGraph, voronoiVerts, yuvImage, imgWidth, imgHeight, getPixelData, buildGhostSplines=false) {
	var adjacencyList = {}

	var edges = []
	var edgesByVertex = {}

	for (var x = 0; x < imgWidth; x++) {	
		for (var y = 0; y < imgHeight; y++) {
			var thisPixelVoronoiVerts = null
			
			try {
				thisPixelVoronoiVerts = [...voronoiVerts[x][y], voronoiVerts[x][y][0]].map(vert => voronoiVertexIndex_to_globallyUniqueIndex[vert](x, y)) 
			} catch (e) {
				console.log('Voronoi vertex lookup error: ')
				console.log({vert, x, y, thisPixelVoronoiVerts, voronoiVerts})
				throw e
			}

			for (var q = 0; q < nextNeighbors.length; q++) { // we'll only consider neighbors 0, 1, 2, and 3 in order to prevent duplicates. the pixels before this one will have 7 covered, and the pixels below will cover 4, 5, and 6
				var i = nextNeighbors[q]
				if (similarityGraph[x][y][i] && !(buildGhostSplines && differentColors(yuvImage[x][y], yuvImage[x+deltas[i][0]][y+deltas[i][1]]))) continue; // no splines exist on the boundries of similar pixels, unless we're building ghost splines

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

					const edge = {vert0: globalIndex0, vert1: globalIndex1}
					edges.push(edge)
					edgesByVertex[globalIndex0] = edgesByVertex[globalIndex0] || []
					edgesByVertex[globalIndex1] = edgesByVertex[globalIndex1] || []
					edgesByVertex[globalIndex0].push(edge)
					edgesByVertex[globalIndex1].push(edge)

					// for later, cache whether this edge will eventually be part of a "contour" spline. that is, a spline that separates two VERY dissimilar colors
					if (veryDissimilarColors(yuvImage[x][y], yuvImage[neighborX][neighborY])) {
						pointsThatArePartOfContouringSplines[globalIndex0] = true
						pointsThatArePartOfContouringSplines[globalIndex1] = true
					} else if (!dissimilarColors(yuvImage[x][y], yuvImage[neighborX][neighborY])){
						pointsThatArePartOfGhostSplines[globalIndex0] = true
						pointsThatArePartOfGhostSplines[globalIndex1] = true
					}
				}
			}
		}
	}

	// for each edge, determine which spline it should be added to
}

