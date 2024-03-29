var forcedSimilarities = {}

function computeSimilarityGraph(imgWidth, imgHeight, getPixelData) {
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
			var fullyConnected = similarityGraph[x][y][deltaRight_index] // (x,y)comp(x+1,y)
							  && similarityGraph[x][y][deltaDown_index]  // (x,y)comp(x,y+1)
							  && similarityGraph[x+1][y+1][deltaLeft_index]  // (x+1,y+1)comp(x,y+1)
							  && similarityGraph[x+1][y+1][deltaUp_index]  // (x+1,y+1)comp(x+1,y)
			if (fullyConnected)
				removeDiag1 = removeDiag2 = true
			else {
				//
				// handle diagonal crossing resolution
				//
				var diag1Score = 0
				var diag2Score = 0
				
				function numConnections(nodeConnections) { return nodeConnections.reduce((snowball, snow) => snowball+(snow?1:0), 0) }
				
				
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

		// apply the forced similarites
		Object.entries(forcedSimilarities).forEach(([pairString, value]) => {
			// pairstring is expected to be of form "x0,y0-deltaIndex"
			const coords = pairString.split('-').map(coordString => coordString.split(',').map(numString => parseInt(numString)))
			similarityGraph[coords[0][0]][coords[0][1]][coords[1]] = value
		})
	}

	return {
		similarityGraph,
		yuvImage
	}
}
