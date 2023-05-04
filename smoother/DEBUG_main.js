

function main() {
    
	// responding to user click
	// var pixelData = canvas.getContext('2d').getImageData(event.offsetX, event.offsetY, 1, 1).data;
	
	//
	// show input
	//
	
	// show the input image
	var inputCopySVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	drawInputToSVGCanvas(inputCopySVG, imgWidth, imgHeight)
	
	
	//
	// make similarity graph
	//

	const {similarityGraph, yuvImage} = computeSimilarityGraph(imgWidth, imgHeight, getPixelData);

	
	// draw similarity graph
	var similarityGraphSVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	drawInputToSVGCanvas(similarityGraphSVG, imgWidth, imgHeight, yuvImage)
	drawSimilarityGraphToSVGCanvas(similarityGraphSVG, imgWidth, imgHeight, similarityGraph)
	
	//
	// Converting from similarity graph to voronoi diagram
	//



	const {voronoiVerts} = computeLocalVoronoiVertsPerPixel(similarityGraph, imgWidth, imgHeight);


	// fix corners where 3 or 4 dissimilar colors meet
	const HEAL_3_COLOR_MEETINGS = true; 
	if (HEAL_3_COLOR_MEETINGS) heal3ColorMeetings(voronoiVerts, yuvImage, imgWidth, imgHeight)

	// draw voronoi :)
	var voronoiSVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	drawVoronoiToSVGCanvas(voronoiSVG, imgWidth, imgHeight, voronoiVerts, voronoiCellVertexPositions)
	if (false) drawSimilarityGraphToSVGCanvas(voronoiSVG, imgWidth, imgHeight)

	// tempConnections.forEach(([x, y, neightborIndex]) => {
	// 	console.log({x,y,neightborIndex})
	// 	var delta = deltas[neightborIndex]
	// 	var newX = x + delta[0]
	// 	var newY = y + delta[1]
	// 	makeLine(voronoiSVG, x*pixelSize+pixelSize/2, y*pixelSize+pixelSize/2, newX*pixelSize+pixelSize/2, newY*pixelSize+pixelSize/2, [255, 0, 0])
	// })

	// // revert temporary connections
	// tempConnections.forEach(([x, y, neightborIndex]) => similarityGraph[x][y][neightborIndex] = false)


	//
	// splines
	//

	// draw splines between all dissimilar colors, along the voronoi edges they share
	
    const splinesComputation = computeSplinesByGlobalIndices(similarityGraph, voronoiVerts, yuvImage, imgWidth, imgHeight, getPixelData, true)

	// draw splines approximation (SVG)
	// this will help me see if the splines were generated correctly
	var splinesSvg = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	drawSplinesToSVGCanvas(splinesSvg, splinesComputation)


	// draw splines
	var splinesCanvas = initRaster(imgWidth*pixelSize, imgHeight*pixelSize)
	drawSplinesToRasterCanvas(splinesCanvas, splinesComputation)

	//
	// smoothen splines
	//

	const {splineObjects} = smoothenSplines(splinesComputation.splines);


	// draw smoothened splines
	var smoothedSplinesCanvas = initRaster(imgWidth*pixelSize, imgHeight*pixelSize)

	drawSplineObjectsToRasterCanvas(smoothedSplinesCanvas, {splineObjects})

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




	var colorCanvas = initRaster(imgWidth*pixelSize, imgHeight*pixelSize)
	floodfillNormalImage(colorCanvas, splineObjects, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage)


	var vectorCanvas = initRaster(imgWidth*pixelSize, imgHeight*pixelSize)
	floodfillDirectionVectorsImage(vectorCanvas, splineObjects, imgWidth)


	var dfCanvas = initRaster(imgWidth*pixelSize, imgHeight*pixelSize)
	floodfillEdgeDistanceFieldImage(dfCanvas, splineObjects, imgWidth)



	// TODO: gaussian blur
    var blurCanvas = initRaster(imgWidth*pixelSize, imgHeight*pixelSize)
	floodfillNormalImage(blurCanvas, splineObjects, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage)
    gauss(blurCanvas, 2)
	
	//const splinePaths = splineObjects.map(splineObject => splineObject.toPath())
	
	// for each edge in each spline path, round the endpoints down to the nearest integer x,y muliple of pixelSize, to find which pixel each endpoint lives in
	// if they live in the same pixel, mark this edge as part of the pixel's spline-cut bounds
	// if they live in different pixels, find the point where this edge crosses the edge of the pixel, and add the edge formed by that and one endpoint to the one pixel, and that and the other endpoint to the other pixel

	// now, generate all the spline-cut pixels 
	// now, on top of that, generate the triangle mesh of all connected pixels - do this by iterating over the image the same way as when checking for 3 color meetings, forming triangles only between sets of 3 pixels that are mutually connected, directly or indirectly
}

// onInit is a variable in smoother.js, which handles the image loading and stuff
onInit = main