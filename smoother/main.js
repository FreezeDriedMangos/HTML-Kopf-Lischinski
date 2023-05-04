
// state data
var hasLoaded = false

// graphics settings
var selected = 'raw (svg)'
var showSimilarityGraph = false

// cached graphics data
var canvases = {}

// computation results
var computation_similarityGraph = {}
var computation_voronoi = {}
var computation_splines = {}
var computation_smothenedSplines = {}

// computation settings
var HEAL_3_COLOR_MEETINGS = true
// var pixelSize // exists in smoother.js



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

	computation_smothenedSplines = smoothenSplines(computation_splines.splines);

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
		event.target.style.color = 'green' // ??? show the user that this type has been rendered
	}

	if (canvases[selected]) canvases[selected].style.display = 'block'
}

function renderSimilarityGraphToggled(event) {
	showSimilarityGraph = !showSimilarityGraph
	if (selected.match(/\(.*\)/g)[0] === "(svg)") rerender()
}

function upscaleFactorChanged(event) {
	try {
		pixelSize = Math.floor(Number.parseFloat(event.target.value))
		
		Object.values(canvases).forEach(canvas => canvas.remove())
		canvases = {} // canvases need to be rebuilt with the new size
		
		rerender()
	} catch {}
}

function main() {
	compute()
    rerender()

	hasLoaded = true
}

// onInit is a variable in smoother.js, which handles the image loading and stuff
onInit = main