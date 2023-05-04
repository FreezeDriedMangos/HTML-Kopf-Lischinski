

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


	// // input is of form [[weight, color], ...]
	// function weightedAverage(colorWeights) {
	// 	var sum = colorWeights.reduce((s, colorWeight) => s+colorWeight[0], 0)
	// 	return colorWeights.reduce((output, colorWeight) => {
	// 		const scale = colorWeight[0]/sum
	// 		return colorWeight[1].map(channel => channel*scale)
	// 	}, [0,0,0,0])
	// }

	// const PIXEL_SHADING_RADIUS = 1
	// const ONE_OVER_SQRT_2PI = 1 / Math.sqrt(2*Math.PI)
	// const SIGMA = 1
	// const SIGMA_SQUARED = SIGMA*SIGMA
	// const UPSCALE = 5

	// function gaussian(distanceSquared) {
	// 	return (1/SIGMA)*ONE_OVER_SQRT_2PI*Math.exp(-0.5*distanceSquared/SIGMA_SQUARED)
	// }

	// var finalColorCanvas = document.createElement('canvas');
	// finalColorCanvas.width = imgWidth*UPSCALE;
	// finalColorCanvas.height = imgHeight*UPSCALE;
	// document.body.appendChild(finalColorCanvas);

	// const ctx = finalColorCanvas.getContext('2d')
	// // var imagedata = finalColorCanvas.getContext('2d').createImageData(imgWidth*UPSCALE, imgHeight*UPSCALE);
	// var buffer = new Uint8ClampedArray(imgWidth*UPSCALE * imgHeight*UPSCALE * 4);

	// for (var y = 0; y < imgHeight*UPSCALE; y++) {
	// 	console.log('starting row')
	// 	for (var x = 0; x < imgWidth*UPSCALE; x++) {
	// 		var outputIndex = (y * imgWidth*UPSCALE + x) * 4;

	// 		var px = Math.floor(x/UPSCALE)
	// 		var py = Math.floor(y/UPSCALE)

	// 		const colorWeights = []
	// 		for (var dx = -PIXEL_SHADING_RADIUS; dx <= PIXEL_SHADING_RADIUS; dx++) {
	// 			for (var dy = -PIXEL_SHADING_RADIUS; dy <= PIXEL_SHADING_RADIUS; dy++) { 
	// 				var originalImagePixelScaledX = (px+dx)*UPSCALE
	// 				var originalImagePixelScaledY = (py+dy)*UPSCALE

	// 				var distToOriginalImagePixelSquared = (originalImagePixelScaledX-x)+(originalImagePixelScaledX-x) * (originalImagePixelScaledY-y)+(originalImagePixelScaledY-y)
	// 				colorWeights.push([gaussian(distToOriginalImagePixelSquared), getPixelData(px+dx, py+dy)])
	// 			}
	// 		}

	// 		const thisPixelColor = weightedAverage(colorWeights)
	// 		buffer[outputIndex+0] = thisPixelColor[0]
	// 		buffer[outputIndex+1] = thisPixelColor[1]
	// 		buffer[outputIndex+2] = thisPixelColor[2]
	// 		buffer[outputIndex+3] = thisPixelColor[3]
	// 	}

	// }

	// console.log("dome buildngin imaged ata");
	// var imagedata = ctx.createImageData(imgWidth*UPSCALE, imgHeight*UPSCALE);
	// imagedata.data.set(buffer);
	// //ctx.putImageData(imagedata, 0, 0);
	// // finalColorCanvas.getContext('2d').putImageData(imagedata, 0, 0);

	
	// // const BLENDING_RADIUS = 2;
	// // const ONE_OVER_BLENDING_RADIUS = 1/BLENDING_RADIUS;

	// // var colorsSVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);

	// // var gradientsMade = {}
	// // for (var x = 0; x < imgWidth; x++) {
	// // 	for (var y = 0; y < imgHeight; y++) {
	// // 		var gradientName = 'g'+getPixelData(x, y).join('g')
	// // 		if (!gradientsMade[gradientName]) {
	// // 			gradientsMade[gradientName] = true
	// // 			var color = rgbToHex(...getPixelData(x, y))
	// // 			makeGradient(colorsSVG, gradientName, [
	// // 				[(ONE_OVER_BLENDING_RADIUS*100)+'%', color], 
	// // 				['100%', color.slice(0, 7)+'00']
	// // 			])
	// // 		}

	// // 		makeCircle(colorsSVG, x*pixelSize*2, y*pixelSize*2, BLENDING_RADIUS*pixelSize, `url('#${gradientName}')`)
	// // 		// makeCircle(colorsSVG, x*pixelSize, y*pixelSize, BLENDING_RADIUS*pixelSize)
	// // 	}
	// // }

	//const splinePaths = splineObjects.map(splineObject => splineObject.toPath())
	
	// for each edge in each spline path, round the endpoints down to the nearest integer x,y muliple of pixelSize, to find which pixel each endpoint lives in
	// if they live in the same pixel, mark this edge as part of the pixel's spline-cut bounds
	// if they live in different pixels, find the point where this edge crosses the edge of the pixel, and add the edge formed by that and one endpoint to the one pixel, and that and the other endpoint to the other pixel

	// now, generate all the spline-cut pixels 
	// now, on top of that, generate the triangle mesh of all connected pixels - do this by iterating over the image the same way as when checking for 3 color meetings, forming triangles only between sets of 3 pixels that are mutually connected, directly or indirectly
}

// onInit is a variable in smoother.js, which handles the image loading and stuff
onInit = main