

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

function computeSplinesByGlobalIndices(similarityGraph, voronoiVerts, yuvImage, imgWidth, imgHeight, buildGhostSplines=false) {
	// iterate over each pixel and check each of its neighbors for dissimilar pixels
	// when a pair of dissimilar pixels is found, record any edges that they share. these edges will eventually be stitched together into the splines
	var pointsThatArePartOfContouringSplines = {}
	var pointsThatArePartOfGhostSplines = {}
	var adjacencyList = {}
	for (var x = 0; x < imgWidth; x++) {	
		for (var y = 0; y < imgHeight; y++) {
			var thisPixelVoronoiVerts = null
			
			thisPixelVoronoiVerts = [...voronoiVerts[x][y], voronoiVerts[x][y][0]].map(vert => voronoiVertexIndex_to_globallyUniqueIndex[vert](x, y)) 

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
					} else if (!dissimilarColors(yuvImage[x][y], yuvImage[neighborX][neighborY])){
						pointsThatArePartOfGhostSplines[globalIndex0] = true
						pointsThatArePartOfGhostSplines[globalIndex1] = true
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

	// check for edges whose two vertices are both valence3-or-higher nodes
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
		var bestAngle = -10
		pairsToConsiderJoining.forEach(([p0, p1]) => {
			function cartesianToRelativePolarTheta(x, y) {
				return Math.atan2(y-point[1] , x-point[0])
			}

			var theta0 = cartesianToRelativePolarTheta(...p0)
			var theta1 = cartesianToRelativePolarTheta(...p1)
			var angle = Math.PI - Math.abs(theta0-theta1)

			if (angle > bestAngle) {
				bestAngle = angle
				bestPair = [p0, p1]
			}
		})

		// we've got our points! convert them to splines
		joinSpline0 = splinesByConstituents[bestPair[0]]
		joinSpline1 = splinesByConstituents[bestPair[1]]

		// add self to all adjacent splines (whether a spline gets joined with another or just terminates, this has to happen anyway)
		allConnectedSplines.forEach(spline => {
			if (!spline) { console.error("Found a null spline. The evalutation will likely fail further down the line."); return } // TODO: this should never be null
			if (adjacencyList[point].includes(spline[0])) spline.unshift(point) // this point is adjacent to the start of the spline
			else if (adjacencyList[point].includes(spline[spline.length-1])) spline.push(point) // this point is adjacent to the end of the spline
			else { console.error("attempted to add a point to a non-adjacent spline"); console.log(adjacencyList[point]); console.log(spline) }
		})

		if (!joinSpline0 || !joinSpline1) return // TODO: these should never be null

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
	

	// // remove redundant (colinear) points
	// splines.forEach(spline => {
	// 	for(var i = 0; i < spline.length-2; i++) {
	// 		// if spline[i], spline[i+1], and spline[i+2] are colinear, delete spline[i+1] and do i--
	// 		// colinearity formula https://math.stackexchange.com/a/405981
	// 		var [a,b] = spline[i]
	// 		var [m,n] = spline[i+1]
	// 		var [x,y] = spline[i+2]
	// 		if ((n-b)*(x-m)==(y-n)*(m-a)){
	// 			spline.splice(i+1, 1) // js arrays have no removeAt function, so I gotta do this
	// 			i--;
	// 		}
	// 	}
	// })

	return {
		splines,
		splinesByConstituents,
		adjacencyList,
		pointsThatArePartOfContouringSplines,
		pointsThatArePartOfGhostSplines
	}
}
