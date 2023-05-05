
// state data
var hasLoaded = false

// graphics settings
var selected = 'raw (svg)'
var showSimilarityGraph = false
var blurBoundries = true

// cached graphics data
var canvases = {}

// computation results
var pallette = undefined
var computation_similarityGraph = {}
var computation_voronoi = {}
var computation_splines = {}
var computation_smothenedSplines = {}

// computation settings
var HEAL_3_COLOR_MEETINGS = true
// var pixelSize // exists in smoother.js


//
// Compute and render
//

function rerender(partial=true) {
	// init canvas (if necessary)
	if (!canvases[selected]) {
		canvases[selected] = 
			selected.match(/\(.*\)/g)[0] === "(svg)" 
			? initSVG(pixelSize*imgWidth, pixelSize*imgHeight, 'canvasRoot') 
			: initRaster(imgWidth*pixelSize, imgHeight*pixelSize, 'canvasRoot')

		canvases[selected].id = selected + " canvas"

		canvases[selected].onclick = 
			selected.match(/\(.*\)/g)[0] === "(svg)" 
			? svgCanvasClicked
			: rasterCanvasClicked
	}
	
	const canvas = canvases[selected]

	// clear canvas
	if (selected.match(/\(.*\)/g)[0] === "(svg)") canvas.innerHTML = "";
	else canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)

	// rerender
	rerender_withoutOverlays(canvas, partial)
	if (showSimilarityGraph && selected.match(/\(.*\)/g)[0] === "(svg)") drawSimilarityGraphToSVGCanvas(canvas, imgWidth, imgHeight, computation_similarityGraph.similarityGraph)
}

function compute(stoppingPoint) {
	//
	// make similarity graph
	//

	computation_similarityGraph = computeSimilarityGraph(imgWidth, imgHeight, getPixelData);
	const {similarityGraph, yuvImage} = computation_similarityGraph
	
	if (stoppingPoint === 'similarity graph (svg)') return

	//
	// Converting from similarity graph to voronoi diagram
	//

	computation_voronoi = computeLocalVoronoiVertsPerPixel(similarityGraph, imgWidth, imgHeight);
	const {voronoiVerts} = computation_voronoi
	if (HEAL_3_COLOR_MEETINGS) heal3ColorMeetings(voronoiVerts, yuvImage, imgWidth, imgHeight)


	if (stoppingPoint === 'voronoi (svg)') return

	//
	// splines
	//

	// draw splines between all dissimilar colors, along the voronoi edges they share
	
    computation_splines = computeSplinesByGlobalIndices(similarityGraph, voronoiVerts, yuvImage, imgWidth, imgHeight, getPixelData, true)

	if (stoppingPoint === 'splines (svg)') return
	if (stoppingPoint === 'splines (raster)') return

	//
	// smoothen splines
	//

	computation_smothenedSplines = smoothenSplines(computation_splines.packagedSplinePrototypes)

	// draw smoothened splines
	if (stoppingPoint === 'smooth splines (raster)') return
}

function rerender_withoutOverlays(canvas, partial=true) {

	const {similarityGraph, yuvImage} = computation_similarityGraph
	const {voronoiVerts} = computation_voronoi
	const {splineObjects} = computation_smothenedSplines

	//
	// raw input
	//

	if (selected === 'raw (svg)') {
		drawInputToSVGCanvas(canvas, imgWidth, imgHeight)
		if (partial) return
	}
	
	//
	// draw voronoi :)
	//

	if (selected === 'voronoi (svg)') {
		drawVoronoiToSVGCanvas(canvas, imgWidth, imgHeight, voronoiVerts, voronoiCellVertexPositions)
		if (partial) return
	}


	//
	// splines
	//

	// draw splines approximation (SVG)
	if (selected === 'splines (svg)') {
		drawSplinesToSVGCanvas(canvas, computation_splines)
		if (partial) return
	}

	// draw splines
	if (selected === 'splines (raster)') {
		drawSplinesToRasterCanvas(canvas, computation_splines)
		if (partial) return
	}

	//
	// smoothen splines
	//

	// draw smoothened splines
	if (selected === 'smooth splines (raster)') {
		drawSplineObjectsToRasterCanvas(canvas, {splineObjects})
		if (partial) return
	}

	//
	//
	// color the image
	//
	//


	// TODO: compute ALL splines, not just splines between dissimilarColors. Compute splines between similar colors too.
	// then flood fill, 
	// then gaussian blur, but do not blur accross splines separating dissimilarColors
    // then do a much gentler gaussian blur for anti-aliasing
	// https://stackoverflow.com/questions/98359/fastest-gaussian-blur-implementation

	if (selected === 'floodfill unsmoothened (raster)') {
		const objs = computation_splines.packagedSplinePrototypes.map(packagedSplinePrototype => {
			const splinePointIndexes = packagedSplinePrototype.points
	
			var absolutePoints = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i))
			var absolutePoints_scaled = absolutePoints.map(point => [pixelSize*point[0], pixelSize*point[1]])
			
			const splineObject = new ClampedClosedBSpline(4, absolutePoints_scaled)
			splineObject.isContouringSpline = packagedSplinePrototype.isContouringSpline
			splineObject.isGhostSpline = packagedSplinePrototype.isGhostSpline
			return splineObject
		})

		floodfillNormalImage(canvas, objs, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage, blurBoundries)
		if (partial) return
	}

	if (selected === 'floodfill (raster)') {
		floodfillNormalImage(canvas, splineObjects, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage, blurBoundries)
		if (partial) return
	}
	
	if (selected === 'direction (raster)') {
		floodfillDirectionVectorsImage(canvas, splineObjects, imgWidth)
		if (partial) return
	}
	
	if (selected === 'distance field (raster)') {
		floodfillEdgeDistanceFieldImage(canvas, splineObjects, imgWidth)
		if (partial) return
	}


	if (selected === 'floodfill blurred (raster)') {
		floodfillNormalImage(canvas, splineObjects, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage)

		const boundaries = {}
		const w = imgWidth*pixelSize;
		splineObjects.forEach(splineObject => {
			if (splineObject.isGhostSpline) return // if it's a ghost spline, it's not a boundary

			var path = splineObject.toPath(pixelSize)
			for (var i = 0; i < path.length-1; i++) {
				var vector = [path[i+1][0]-path[i][0], path[i+1][1]-path[i][1]] // vector from this point to the next point
				var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1]) // distance between this point and next point
				var dirNormalized = [vector[0]/mag, vector[1]/mag]             // direction to next point
				var magCiel = Math.ceil(mag)

				var loc = [path[i][0], path[i][1]]
				for (var j = 0; j <= magCiel+1; j++) {
					const indx = Math.trunc(loc[1])*w+Math.trunc(loc[0])
					boundaries[indx] = true
					loc[0] += dirNormalized[0]
					loc[1] += dirNormalized[1]
				}
			}
		})

		for (var i = 0; i < 3; i++) gauss(canvas, 1, boundaries)
		if (partial) return
	}
}

// I've got it!! When the user clicks a spline to override its status, mark the EDGE they clicked! that edge will be marked as "forced to be a ghost/contouring/normal spline" and then during generation, any spline containing a forced edge will take on the state of that edge. if it contains two forced edges of a different type, the spline will be split into two separate splines as a final step in splineGeneration.js (after all the existing steps)
// note: not available for smoothened splines, since they delete points

var markedEdges = {}

var pixelToEdge = {}
var edgeToState = {}

function compileSplineObjectPixels() {
	computation_splines.packagedSplinePrototypes.forEach(packagedSplinePrototype => {
		const splinePointIndexes = packagedSplinePrototype.points
		var color = packagedSplinePrototype.isContouringSpline
			? [0,0,0] 
			: packagedSplinePrototype.isGhostSpline
				? [220,220,220]
				: [70,70,180]
		
		var points = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
		for(var i = 0; i < points.length-1; i++) {
			const edge = splinePointIndexes[i] + ' - ' + splinePointIndexes[i+1]
			edgeToState[edge] = {isGhostSpline: packagedSplinePrototype.isGhostSpline, isContouringSpline: packagedSplinePrototype.isContouringSpline}

			var vector = [points[i+1][0]-points[i][0], points[i+1][1]-points[i][1]] // vector from this point to the next point
			var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1]) // distance between this point and next point
			var dirNormalized = [vector[0]/mag, vector[1]/mag]             // direction to next point
			var magCiel = Math.ceil(mag)

			var loc = [points[i][0], points[i][1]]
			for (var j = 0; j <= magCiel+1; j++) {
				

				// make a 5x5 hitbox around each pixel so it's easier for the user to click on them
				for(var dx = -2; dx <= 2; dx++)
					for(var dy = -2; dy <= 2; dy++)	
						pixelToEdge[Math.floor(loc[0]+dx)+','+Math.floor(loc[1]+dy)] = edge


				loc[0] += dirNormalized[0]
				loc[1] += dirNormalized[1]
			}
		}
	})
}


//
// Canvas clicked
//

// function modified from https://stackoverflow.com/a/42711775
function svgCanvasClicked(evt) {
	const svg = canvases[selected]
	var pt = svg.createSVGPoint();  // Created once for document

    pt.x = evt.clientX;
    pt.y = evt.clientY;

    // The cursor point, translated into svg coordinates
    var cursorpt =  pt.matrixTransform(svg.getScreenCTM().inverse());

	handleClick(cursorpt.x, cursorpt.y)
}

// function modified from https://stackoverflow.com/a/42111623
function rasterCanvasClicked(e) {
	// e = Mouse click event.
	var rect = e.target.getBoundingClientRect();
	var x = e.clientX - rect.left; //x position within the element.
	var y = e.clientY - rect.top;  //y position within the element.
	
	handleClick(x, y)
}

// both types of canvas click handler return the same coordinates when the mouse clicks the same place, so we can have just one click handler :)
function handleClick(x, y) {
	x = Math.floor(x)
	y = Math.floor(y)

	console.log('clicked ('+x+','+y+')')

	if (selected === 'splines (svg)' || selected === 'splines (raster)') {
		const edgeClicked = pixelToEdge[x+','+y]
		
		if (!edgeClicked) return

		// update edge state and redraw this edge
		if (edgeToState[edgeClicked].isContouringSpline) {
			edgeToState[edgeClicked] = {isContouringSpline: false, isGhostSpline: false}
			markedEdges[edgeClicked] = {isContouringSpline: false, isGhostSpline: false}
		} else if (edgeToState[edgeClicked].isGhostSpline) {
			edgeToState[edgeClicked] = {isContouringSpline: true, isGhostSpline: false}
			markedEdges[edgeClicked] = {isContouringSpline: true, isGhostSpline: false}
		} else {
			edgeToState[edgeClicked] = {isContouringSpline: false, isGhostSpline: true}
			markedEdges[edgeClicked] = {isContouringSpline: false, isGhostSpline: true}
		}
		
		var splineFound = undefined
		for (var i = 0; i < computation_splines.packagedSplinePrototypes.length; i++) {
			var packagedSplinePrototype = computation_splines.packagedSplinePrototypes[i]

			for (var j = 0; j < packagedSplinePrototype.points.length - 1; j++) {
				const edge = packagedSplinePrototype.points[j] + ' - ' + packagedSplinePrototype.points[j+1]
				const inverseEdge = packagedSplinePrototype.points[j+1] + ' - ' + packagedSplinePrototype.points[j]

				if (edge === edgeClicked || inverseEdge === edgeClicked) {
					splineFound = i
					break
				}
			}

			if (splineFound != undefined) break
		}
		
		if (splineFound == undefined) return

		for (var j = 0; j < packagedSplinePrototype.points.length - 1; j++) {
			const edge = packagedSplinePrototype.points[i] + ' - ' + packagedSplinePrototype.points[i+1]
			const inverseEdge = packagedSplinePrototype.points[j+1] + ' - ' + packagedSplinePrototype.points[j]

			edgeToState[edge] = edgeToState[inverseEdge] = edgeToState[edgeClicked]
			markedEdges[edge] = markedEdges[inverseEdge] = edgeToState[edgeClicked]
		}

		// redraw this edge
		const color = edgeToState[edgeClicked].isContouringSpline
			? [0,0,0] 
			: edgeToState[edgeClicked].isGhostSpline
				? [220,220,220]
				: [130,130,220]

		if (selected === "splines (raster)") {
			const ctx = canvases[selected].getContext('2d')

			const splinePointIndexes = computation_splines.packagedSplinePrototypes[splineFound].points
			var pts = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
			for(var i = 0; i < pts.length-1; i++) {
				var vector = [pts[i+1][0]-pts[i][0], pts[i+1][1]-pts[i][1]] // vector from this point to the next point
				var mag = Math.sqrt(vector[0]*vector[0] + vector[1]*vector[1]) // distance between this point and next point
				var dirNormalized = [vector[0]/mag, vector[1]/mag]             // direction to next point
				var magCiel = Math.ceil(mag)

				var loc = [pts[i][0], pts[i][1]]
				for (var j = 0; j <= magCiel+1; j++) {
					ctx.fillStyle = "rgba("+color.toString()+","+255+")";
					ctx.fillRect(loc[0], loc[1], 1, 1)

					loc[0] += dirNormalized[0]
					loc[1] += dirNormalized[1]
				}
			}
		} else if (selected === "splines (svg)") {
			const splinePointIndexes = computation_splines.packagedSplinePrototypes[splineFound].points
		
			var pts = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
			for(var i = 0; i < pts.length-1; i++) {
				makeLine(canvases[selected], ...pts[i], ...pts[i+1], color)
			}
		}
	}

}

//
// HTML Input element clicked
//

function renderTypeSelected(event) {
	if (canvases[selected]) canvases[selected].style.display = 'none'

	selected = event.target.id
	if (!canvases[selected]) 
	{
		rerender()
		event.target.style.color = 'green' // ??? show the user that this type has been rendered
	}

	if (canvases[selected]) canvases[selected].style.display = 'block'
}

function renderSimilarityGraphToggled(event) {
	showSimilarityGraph = event.target.checked
	if (selected.match(/\(.*\)/g)[0] === "(svg)") rerender()
}

function blurBoundriesToggled(event) {
	blurBoundries = event.target.checked
	if (selected.match(/\(.*\)/g)[0] === "(raster)") rerender()
}

function upscaleFactorChanged(event) {
	try {
		pixelSize = Math.floor(Number.parseFloat(event.target.value))
		
		Object.values(canvases).forEach(canvas => canvas.remove())
		canvases = {} // canvases need to be rebuilt with the new size

		rerender()
	} catch {}
}

function similaritySwatchClicked(palletteColor1, palletteColor2, swatchElement) {
	const similarityScore = dissimilarityScore(palletteColor1, palletteColor2)

	palletteOverrides[palletteColor1.toString()] = palletteOverrides[palletteColor1.toString()] || {}
	palletteOverrides[palletteColor2.toString()] = palletteOverrides[palletteColor2.toString()] || {}

	palletteOverrides[palletteColor1.toString()][palletteColor2.toString()] = (similarityScore+1)%4 
	palletteOverrides[palletteColor2.toString()][palletteColor1.toString()] = (similarityScore+1)%4 

	switch ((similarityScore+1)%4) {
		case 0: swatchElement.style.backgroundColor = '#ffffff'; break
		case 1: swatchElement.style.backgroundColor = '#ffff00'; break
		case 2: swatchElement.style.backgroundColor = '#ffaa00'; break
		case 3: swatchElement.style.backgroundColor = '#ff0000'; break
	}
	
	swatchElement.style.border = '1px solid green'
}


//
// main
//

function recompute() {
	Object.values(canvases).forEach(canvas => canvas.remove())
	canvases = {} // canvases need to be rebuilt with the new size

	compute()
	compileSplineObjectPixels() // bonus computation used for ui only
	rerender()
}

function main() {
	selected = 'raw (svg)'
	document.getElementById('raw (svg)').checked = true
	document.getElementById('drawSimilarityGraph').checked = showSimilarityGraph
	document.getElementById('blurBoundries').checked = blurBoundries

	palletteOverrides = {} // clear overrides, we'll be getting a new pallette anyway

	compute()
	compileSplineObjectPixels() // bonus computation used for ui only
    rerender()

	pallette = getPallette() // not needed for the algortihm, so this is handled outside of compute() and rerender()
	drawSimilarityGrid(pallette, 'pallette', 10, similaritySwatchClicked)
	
	hasLoaded = true
}

// onInit is a variable in smoother.js, which handles the image loading and stuff
onInit = main