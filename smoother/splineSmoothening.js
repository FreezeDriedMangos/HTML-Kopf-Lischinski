
function smoothenSplines(splines) {
	return smoothenByRandomDeletionAndHighDegree(splines)
}

function smoothenByRandomDeletionAndHighDegree(splines) {
	const splineObjects = splines.map(splinePointIndexes => {
		var newIndexes = [...splinePointIndexes]
		for (var i = 1; i < newIndexes.length-1; i++) {
			if (newIndexes.length < 8) break;
			if (Math.random() > 0.6) newIndexes.splice(i, 1)
		}
		
		var absolutePoints = newIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i))
		var absolutePoints_scaled = absolutePoints.map(point => [pixelSize*point[0], pixelSize*point[1]])
		
		return new ClampedClosedBSpline(8, absolutePoints_scaled);
	})

	return {splineObjects}
}

function smoothenByCurvature(splines) {
	const POSITOINAL_ENERGY_WEIGHT = 0
	const MAX_RANDOM_OFFSET = 0.5*pixelSize
	const CURVATURE_INTEGRAL_INTERVALS_PER_SPAN = 20
	const NUM_OPTOMIZATION_GUESSES_PER_POINT = 20
	const SPLINE_DEGREE = 3 // must be at least 3

	const splineObjects = splines.map(splinePointIndexes => {
		var absolutePoints = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i))
		var absolutePoints_scaled = absolutePoints.map(point => [pixelSize*point[0], pixelSize*point[1]])
		return new ClampedClosedBSpline(SPLINE_DEGREE, absolutePoints_scaled)
	})

	function energyCurvature(spline, index) {
		return spline.IntegrateCurvature(index, CURVATURE_INTEGRAL_INTERVALS_PER_SPAN)
	}

	function energyPosition(originalPoint, point) {
		return Math.pow( Math.abs(point[0]-originalPoint[0])+Math.abs(point[1]-originalPoint[1]) , 4)
	}

	function pointEnergy(spline, index, originalPoint) {
		return energyCurvature(spline, index) + 
			POSITOINAL_ENERGY_WEIGHT*energyPosition(originalPoint, spline.points[index])
	}

	function randomPointOffset(point) {
		var r = Math.random()*MAX_RANDOM_OFFSET+0.36 // 0.36 is roughly the distance needed to get to the point that's up 0.25 and left 0.25
		var a = Math.random()*2*Math.PI
		// a random point in a circle of radius MAX_RANDOM_OFFSET around the original
		const randPoint = [r*Math.cos(a)+point[0],
						   r*Math.sin(a)+point[1]]

		// quantize that point to a grid of size 0.25
		return [Math.floor(4*randPoint[0])*0.25,
				Math.floor(4*randPoint[1])*0.25]
	}

	splineObjects.splice(1, splineObjects.length-1) // TODO: remove this debug line

	splineObjects.forEach(splineObject => {
		splineObject.points.forEach((point, index) => {
			//# The function which is used to optimize the position of a point
			const start = [...splineObject.points[index]]
			const energies = []
			energies.push([, start])
			var bestEnergy = pointEnergy(splineObject, index, start)
			var bestEnergy_point = start

			for(var i = 0; i < NUM_OPTOMIZATION_GUESSES_PER_POINT; i++) { // Around 20 guesses are made and the minimum energy one is chosen
				var p = randomPointOffset(start)
				splineObject.points[index][0] = p[0]
				splineObject.points[index][1] = p[1]
				const thisEnergy = pointEnergy(splineObject, index, start)

				if (thisEnergy < bestEnergy) {
					bestEnergy = thisEnergy
					bestEnergy_point = p
				}

			}

			splineObject.points[index][0] = bestEnergy_point[0]
			splineObject.points[index][1] = bestEnergy_point[1]
		})
	})
}

function smoothenByShapesOfBestFit() {
	// TODO: try a different approach to smoothing - simultaneously move all spline points (not spline object points, just the raw spline points) orthogonally towards both the line of best fit and circle of best fit with its n (~5) closest neighbors on each side. that is, move it towards the line/circle of best fit of spline[i-5:i+5] (wrapped/clamped ofc, but also do not try to move endpoints of splines that are not closed)
	

	// const NUM_SMOOTHING_ITERATIONS = 3
	// const SMOOTHING_RANGE = 5
	// const STAY_IN_SAME_PLACE_FORCE_MULTIPLIER = 4

	// function getNeighboringArea(index, range, spline, splineIsClosed) {
	// 	const neighboringArea = [] // [spline[index]] // uncomment this to put the requested index in its proper place in the sequence
	// 	const max = spline.length-1 // the -1 excludes the duplicate of spline[0] at spline[length-1]

	// 	for(var i = 1; i <= range; i++) {
	// 		var left = splineIsClosed ? (i-1+max)%max : i-1
	// 		var right = splineIsClosed ? (i+1)%max : i+1

	// 		if (left >= 0) neighboringArea.unshift(spline[left])
	// 		if (right < max) neighboringArea.push(spline[right])
	// 	}

	// 	neighboringArea.unshift(spline[index]) // for convenience, put the requested index at position 0
	// 	return neighboringArea
	// }
	// function average(points) {
	// 	return [ points.reduce((sum, point) => sum+point[0], 0) / points.length,
	// 			 points.reduce((sum, point) => sum+point[1], 0) / points.length ]
	// }

	// const absoluteSplines = []
	// splines.forEach(spline => {
	// 	var originalPoints = spline.map(p => globallyUniqueIndex_to_absoluteXY(p))
	// 	var splineIsClosed = spline[0] == spline[spline.length-1]

	// 	var absoluteSpline = originalPoints.map(p => p)

	// 	for (var i = 0; i < NUM_SMOOTHING_ITERATIONS; i++) {
	// 		var currentPoints = absoluteSpline.map(point => point)
	// 		absoluteSpline.forEach((point, index) => {
	// 			if (index == 0 && !splineIsClosed) return
	// 			if (index == spline.length-1) return // we don't move the last point, even if the spline is closed. If it is, and we did move it, we'd end up moving that point twice! (since in a closed spline, the last point === the first point, which we've already moved)
	// 			const neighbors = getNeighboringArea(index, SMOOTHING_RANGE, currentPoints, splineIsClosed)

	// 			// get the original point
	// 			const originalPoint = originalPoints[index]

	// 			// get the point given by the line of best fit
	// 			const lineFit = findLineByLeastSquares(neighbors.map(p => p[0]), neighbors.map(p=>p[1]))
	// 			const lineFitPoint = [lineFit[0][0], lineFit[1][0]]

	// 			// get the point given by the circle of best fit
	// 			CIRCLEFIT.resetPoints()
	// 			neighbors.forEach(neighborPoint => CIRCLEFIT.addPoint(...neighborPoint))
	// 			const circleFit = CIRCLEFIT.compute()
	// 			const circleFitPoint = circleFit.success ? [circleFit.projections[0].x, circleFit.projections[0].y] : originalPoint

	// 			// calculate the average of these points, taking into account the weight given to the original point
	// 			const influences = []
	// 			for(var i = 0; i < STAY_IN_SAME_PLACE_FORCE_MULTIPLIER; i++) influences.push(originalPoint)
	// 			influences.push(lineFitPoint)
	// 			influences.push(circleFitPoint)

	// 			const newPoint = average(influences)
	// 			absoluteSpline[index] = newPoint
	// 		})
	// 	}
	// 	//console.log(absoluteSpline)
	// 	absoluteSplines.push(absoluteSpline)
	// })

	// const SPLINE_DEGREE = 3 
	// const splineObjects = absoluteSplines.map(absoluteSpline => {
	// 	var absolutePoints_scaled = absoluteSpline.map(point => [pixelSize*point[0], pixelSize*point[1]])
	// 	return new ClampedClosedBSpline(SPLINE_DEGREE, absolutePoints_scaled)
	// })
	
	return {splineObjects}
}
