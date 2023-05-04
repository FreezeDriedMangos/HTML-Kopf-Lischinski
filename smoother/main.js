
var hasLoaded = false

var selected = 'raw (svg)'
var showSimilarityGraph = false
var similarityGraphComputationResults = {}
const canvases = {}

function rerender(partial=true) {
	// init canvas (if necessary)
	if (!canvases[selected]) {
		canvases[selected] = 
			selected.match(/\(.*\)/g)[0] === "(svg)" 
			? initSVG(pixelSize*imgWidth, pixelSize*imgHeight) 
			: initRaster(imgWidth*pixelSize, imgHeight*pixelSize)

		canvases[selected].id = selected + " canvas"
	}
	
	const canvas = canvases[selected]

	// clear canvas
	if (selected.match(/\(.*\)/g)[0] === "(svg)") canvas.innerHTML = "";
	else canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)

	// rerender
	rerender_withoutOverlays(canvas, partial)
	if (showSimilarityGraph && selected.match(/\(.*\)/g)[0] === "(svg)") drawSimilarityGraphToSVGCanvas(canvas, imgWidth, imgHeight, similarityGraphComputationResults.similarityGraph)
}

// TODO: save all these computation results as global variables, so they only need to be recomputed when needed
function rerender_withoutOverlays(canvas, partial=true) {
	if (selected === 'raw (svg)') {
		drawInputToSVGCanvas(canvas, imgWidth, imgHeight)
		console.log('drew input')
		if (partial) return
	}
	
	
	//
	// make similarity graph
	//

	similarityGraphComputationResults = computeSimilarityGraph(imgWidth, imgHeight, getPixelData);
	const {similarityGraph, yuvImage} = similarityGraphComputationResults
	

	//
	// Converting from similarity graph to voronoi diagram
	//

	const {voronoiVerts} = computeLocalVoronoiVertsPerPixel(similarityGraph, imgWidth, imgHeight);

	// fix corners where 3 or 4 dissimilar colors meet
	const HEAL_3_COLOR_MEETINGS = true; 
	if (HEAL_3_COLOR_MEETINGS) heal3ColorMeetings(voronoiVerts, yuvImage, imgWidth, imgHeight)

	// draw voronoi :)
	if (selected === 'voronoi (svg)') {
		drawVoronoiToSVGCanvas(canvas, imgWidth, imgHeight, voronoiVerts, voronoiCellVertexPositions)
		if (partial) return
	}


	//
	// splines
	//

	// draw splines between all dissimilar colors, along the voronoi edges they share
	
    const splinesComputation = computeSplinesByGlobalIndices(similarityGraph, voronoiVerts, yuvImage, imgWidth, imgHeight, getPixelData, true)

	// draw splines approximation (SVG)
	if (selected === 'splines (svg)') {
		drawSplinesToSVGCanvas(canvas, splinesComputation)
		if (partial) return
	}

	// draw splines
	if (selected === 'splines (raster)') {
		drawSplinesToRasterCanvas(canvas, splinesComputation)
		if (partial) return
	}

	//
	// smoothen splines
	//

	const {splineObjects} = smoothenSplines(splinesComputation.splines);


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

	if (selected === 'floodfill (raster)') {
		floodfillNormalImage(canvas, splineObjects, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage)
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
		gauss(canvas, 1)
		if (partial) return
	}
}

function renderTypeSelected(event) {
	if (canvases[selected]) canvases[selected].style.display = 'none'

	selected = event.target.id
	if (!canvases[selected]) 
	{
		rerender()
		event.target.styles.color = 'green' // ??? show the user that this type has been rendered
	}

	if (canvases[selected]) canvases[selected].style.display = 'block'
}

function renderSimilarityGraphToggled(event) {
	showSimilarityGraph = !showSimilarityGraph
	rerender()
}

function main() {
    rerender()

	hasLoaded = true
}

// onInit is a variable in smoother.js, which handles the image loading and stuff
onInit = main