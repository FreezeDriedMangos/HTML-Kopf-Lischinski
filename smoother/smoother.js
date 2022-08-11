
//
// parameters
//

const inputImageElementID = 'my-image';

const ISLAND_SCORE = 13
const AREA_SCORE_WEIGHT = 1


const pixelSize = 10 // basically the upscale factor

//
// non parameter constants (do not touch)
//

const svgns = "http://www.w3.org/2000/svg";

const deltas = [
	[-1,-1], [0,-1], [1,-1], [1,0], [1, 1], [0,1], [-1,1], [-1,0]
];

const deltaDownRight_index = 4
const deltaDownLeft_index = 6
const deltaRight_index = 3
const deltaUpLeft_index = 0
const deltaUpRight_index = 2

//
// Color Utility
//

// https://stackoverflow.com/a/5624139/9643841
function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b, a) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b) + componentToHex(a);
}

// https://stackoverflow.com/a/17934865
function RGBtoYUV(r, g, b, a=255) {
	const y = Math.floor( 0.257 * r + 0.504 * g + 0.098 * b +  16);
	const u = Math.floor(-0.148 * r - 0.291 * g + 0.439 * b + 128);
	const v = Math.floor( 0.439 * r - 0.368 * g - 0.071 * b + 128);
	return [y, u, v, a]
}


function differentColors(yuv1, yuv2) {
	if (yuv1[3] !== undefined || yuv2[3] !== undefined) // if they have alpha components
		if ((yuv1[3] === 0) !== (yuv2[3] === 0)) return true; // if one is completely transparent and the other is not, the pixels are automatically considered dissimilar

	var dy = Math.abs(yuv1[0]-yuv2[0]) > 0;
	var du = Math.abs(yuv1[1]-yuv2[1]) > 0 ;
	var dv = Math.abs(yuv1[2]-yuv2[2]) > 0 ;
	return dy || du || dv;	
}

function dissimilarColors(yuv1, yuv2) {
	if (yuv1[3] !== undefined || yuv2[3] !== undefined) // if they have alpha components
		if ((yuv1[3] === 0) !== (yuv2[3] === 0)) return true; // if one is completely transparent and the other is not, the pixels are automatically considered dissimilar

	var dy = Math.abs(yuv1[0]-yuv2[0]) > 48;
	var du = Math.abs(yuv1[1]-yuv2[1]) > 7 ;
	var dv = Math.abs(yuv1[2]-yuv2[2]) > 6 ;
	return dy || du || dv;	
}

function veryDissimilarColors(yuv1, yuv2) {
	if (yuv1[3] !== undefined || yuv2[3] !== undefined) // if they have alpha components
		if ((yuv1[3] === 0) !== (yuv2[3] === 0)) return true; // if one is completely transparent and the other is not, the pixels are automatically considered dissimilar

	var dy = Math.abs(yuv1[0]-yuv2[0]) > 100;
	var du = Math.abs(yuv1[1]-yuv2[1]) > 100;
	var dv = Math.abs(yuv1[2]-yuv2[2]) > 100;
	return dy || du || dv;	
}

//
// SVG functions
//

// https://stackoverflow.com/a/8215105/9643841
function initSVG(width = 300, height = 300) {
	var svg = document.createElementNS(svgns, "svg");
	svg.setAttribute('width', width);
	svg.setAttribute('height', height);
	document.body.appendChild(svg);
	return svg
}

// https://stackoverflow.com/a/12786915/9643841
function makeSquare(svg, x, y, size, color) {
	var rect = document.createElementNS( svgns,'rect' );
	rect.setAttributeNS( null,'x',x );
	rect.setAttributeNS( null,'y',y );
	rect.setAttributeNS( null,'width',`${size}` );
	rect.setAttributeNS( null,'height',`${size}` );
	if (color) rect.setAttributeNS( null,'fill',color );
	svg.appendChild(rect)

	return rect
}

function makeLine(svg, x1, y1, x2, y2, color=[0, 0, 0], width=1) {
	//  <line x1="0" y1="0" x2="200" y2="200" style="stroke:rgb(255,0,0);stroke-width:2" />
	
	var line = document.createElementNS( svgns,'line' );
	line.setAttributeNS( null,'x1',x1 );
	line.setAttributeNS( null,'y1',y1 );
	line.setAttributeNS( null,'x2',x2 );
	line.setAttributeNS( null,'y2',y2 );
	line.setAttributeNS( null,'style',`stroke:rgb(${color[0]}, ${color[1]}, ${color[2]});stroke-width:${width}` );
	svg.appendChild(line)

	return line
}

function makePolygon(svg, points, color="#000000") {
	var polygon = document.createElementNS( svgns,'polygon' );
	polygon.setAttributeNS( null,'points', points.map(([x, y]) => x+","+y).join(" ") );
	if (color) polygon.setAttributeNS( null,'fill',color );
	svg.appendChild(polygon)
}

function makeCircle(svg, x, y, r, fill='#000000') {
	var rect = document.createElementNS( svgns,'circle' );
	rect.setAttributeNS( null,'cx', x );
	rect.setAttributeNS( null,'cy', y );
	rect.setAttributeNS( null,'r', r );
	if (fill) rect.setAttributeNS( null,'fill',fill );
	svg.appendChild(rect)

	return rect
}

function makeGradient(svg, name, controlPoints) {
	var gradient = document.createElementNS( svgns,'radialGradient' );
	gradient.setAttributeNS(null, 'id', name)

	controlPoints.forEach(([point, color]) => {
		var gradientStop = document.createElementNS( svgns,'stop' );	
		gradientStop.setAttributeNS(null, 'offset', point);
		gradientStop.setAttributeNS(null, 'stop-color', color);
		gradient.appendChild(gradientStop);
	})

	svg.appendChild(gradient)
	return gradient
}




//
// Trying to load a single image file from the same directory that this html file exists in. God help me
//

// https://stackoverflow.com/a/42498790/9643841
var openFile = function(file) {
    var input = file.target;

    var reader = new FileReader();
    reader.onload = function(){
		var dataURL = reader.result;
		var output = document.getElementById(inputImageElementID);
		output.src = dataURL;
		
		var image = document.createElement("img");
		image.src = dataURL;
		console.log(image.width) // logging the size seems to initialize it
		console.log(image.height)

		if (image.width === 0 || image.height === 0) {
			document.getElementById("warning").innerHTML+= "Image failed to load. Please refresh and try again. (this is very buggy, it will probably work on the 3rd try)"
		}
		
		init()
    };
    reader.readAsDataURL(input.files[0]);
};

//
// kick off processing
//

function init() {
	// https://stackoverflow.com/a/8751659/9643841
	var canvas = null;
	var imgWidth = 0;
	var imgHeight = 0;
	function loadImage() {
		var img = document.getElementById(inputImageElementID);
		
		canvas = document.createElement('canvas');
		imgWidth = canvas.width = img.width;
		imgHeight = canvas.height = img.height;
		canvas.getContext('2d').imageSmoothingEnabled = false
		canvas.getContext('2d').drawImage(img, 0, 0, img.width, img.height);
		console.log({imgWidth, imgHeight})

		// TODO: make an imageWidth+2 by imageHeight+2 array and fill it with the colors of the image, the 1 pixel wide ring on the edges should be filled with [0,0,0,0]
		// then make getPixelData read from this array
		// lastly, actually add 2 to the stored values of imageWidth/imageHeight so they reflect the size of the new array
	}
	function getPixelData(x, y) {
		return canvas.getContext('2d').getImageData(x, y, 1, 1).data;
	}
	loadImage();

	// responding to user click
	// var pixelData = canvas.getContext('2d').getImageData(event.offsetX, event.offsetY, 1, 1).data;
	
	//
	// show input
	//
	
	// show the input image
	var inputCopySVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			makeSquare(inputCopySVG, x*pixelSize, y*pixelSize, pixelSize, rgbToHex(...getPixelData(x, y)))
			// var c = makeCircle(inputCopySVG, x*pixelSize, y*pixelSize, 2*pixelSize, rgbToHex(...getPixelData(x, y)))
			// c.setAttributeNS(null, 'style', "mix-blend-mode: soft-light");
		}
	}
	


	
	//
	// make similarity graph
	//

	const {similarityGraph, yuvImage} = computeSimilarityGraph(imgWidth, imgHeight, getPixelData);

	
	// draw similarity graph
	var similarityGraphSVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			if(yuvImage[x][y][3] <= 0) continue;
			makeSquare(similarityGraphSVG, x*pixelSize, y*pixelSize, pixelSize, rgbToHex(...getPixelData(x, y))) // rgbToHex(...yuvImage[x][y])
		}
	}
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			for (var i = 0; i < deltas.length; i++) {
				var delta = deltas[i]

				var newX = x + delta[0]
				var newY = y + delta[1]
				// if (newX < 0 || newX >= imgWidth || newY < 0 || newY >= imgHeight) continue
				if (similarityGraph[x][y][i] == false) continue;
				makeLine(similarityGraphSVG, x*pixelSize+pixelSize/2, y*pixelSize+pixelSize/2, newX*pixelSize+pixelSize/2, newY*pixelSize+pixelSize/2)
			}
		}
	}

	
	//
	// Converting from similarity graph to voronoi diagram
	//



	const {voronoiVerts} = computeLocalVoronoiVertsPerPixel(similarityGraph, imgWidth, imgHeight);


	// fix corners where 3 or 4 dissimilar colors meet
	const HEAL_3_COLOR_MEETINGS = true; 
	if (HEAL_3_COLOR_MEETINGS) heal3ColorMeetings(voronoiVerts, yuvImage, imgWidth, imgHeight)

	// draw voronoi :)
	var voronoiSVG = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	var skipSimilarityGraph = true;
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			makePolygon(voronoiSVG, voronoiVerts[x][y].map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy]).map(([x, y]) => [pixelSize*x, pixelSize*y]), rgbToHex(...getPixelData(x, y)))

			// draw similarity graph on top
			if (skipSimilarityGraph) continue;
			for (var i = 0; i < deltas.length; i++) {
				var delta = deltas[i]

				var newX = x + delta[0]
				var newY = y + delta[1]
				// if (newX < 0 || newX >= imgWidth || newY < 0 || newY >= imgHeight) continue
				if (similarityGraph[x][y][i] == false) continue;
				makeLine(voronoiSVG, x*pixelSize+pixelSize/2, y*pixelSize+pixelSize/2, newX*pixelSize+pixelSize/2, newY*pixelSize+pixelSize/2)
			}
		}
	}

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
	
    const { splines, splinesByConstituents, adjacencyList, pointsThatArePartOfContouringSplines, pointsThatArePartOfGhostSplines, splineLeftSideColor, splineRightSideColor } = computeSplinesByGlobalIndices(similarityGraph, voronoiVerts, yuvImage, imgWidth, imgHeight, getPixelData, true)

	// draw splines approximation (SVG)
	// this will help me see if the splines were generated correctly
	var splinesSvg = initSVG(pixelSize*imgWidth, pixelSize*imgHeight);
	
	// draw all adjacencies (this highlights edges that were missed when building splines)
	Object.keys(adjacencyList).forEach(globalPointIndex => {
		var point = globallyUniqueIndex_to_absoluteXY(globalPointIndex).map(x_or_y => pixelSize*x_or_y)
		var points = adjacencyList[globalPointIndex].map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
		for(var i = 0; i < points.length; i++) {
			var color = [Math.floor(Math.random()*150)+50, Math.floor(Math.random()*150)+50, Math.floor(Math.random()*150)+50]
			makeLine(splinesSvg, ...point, ...points[i], color)
		}
	})
	
	// draw splines approximation
	splines.forEach(splinePointIndexes => {
		var color = pointsThatArePartOfContouringSplines[splinePointIndexes[0]]
			? [0,0,0] 
			: pointsThatArePartOfGhostSplines[splinePointIndexes[0]]
				? [220,220,220]
				: [180,180,180]
		
		var points = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
		for(var i = 0; i < points.length-1; i++) {
			makeLine(splinesSvg, ...points[i], ...points[i+1], color)
		}
	})



	// draw splines
	var splinesCanvas = document.createElement('canvas');
	splinesCanvas.width = imgWidth*pixelSize;
	splinesCanvas.height = imgHeight*pixelSize;
	document.body.appendChild(splinesCanvas);

	splines.forEach(splinePointIndexes => {
		var absolutePoints = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i))
		var absolutePoints_scaled = absolutePoints.map(point => [pixelSize*point[0], pixelSize*point[1]])
		
		const splineObject = new ClampedClosedBSpline(4, absolutePoints_scaled)
		splineObject.drawToCanvas(splinesCanvas.getContext('2d'), false, color=pointsThatArePartOfContouringSplines[splinePointIndexes[0]]?[0,0,0,255] : [120,120,220,255])
	})

	//
	// smoothen splines
	//

	const {splineObjects} = smoothenSplines(splines, splineLeftSideColor, splineRightSideColor);


	// draw smoothened splines
	var smoothedSplinesCanvas = document.createElement('canvas');
	smoothedSplinesCanvas.width = imgWidth*pixelSize;
	smoothedSplinesCanvas.height = imgHeight*pixelSize;
	document.body.appendChild(smoothedSplinesCanvas);

	splineObjects.forEach(splineObject => {
		splineObject.drawToCanvas(smoothedSplinesCanvas.getContext('2d'), true)
	})

	//
	//
	// color the image
	//
	//



	// TODO: compute ALL splines, not just splines between dissimilarColors. Compute splines between similar colors too.
	// then flood fill, 
	// then gaussian blur, but do not blur accross splines separating dissimilarColors
	// https://stackoverflow.com/questions/98359/fastest-gaussian-blur-implementation




	var colorCanvas = document.createElement('canvas');
	colorCanvas.width = imgWidth*pixelSize;
	colorCanvas.height = imgHeight*pixelSize;
	document.body.appendChild(colorCanvas);
	floodfillNormalImage(colorCanvas, splineObjects, imgWidth, imgHeight, deltas, similarityGraph, getPixelData, yuvImage)

	// splineObjects.forEach(splineObject => {
	// 	splineObject.drawToCanvas(colorCanvas.getContext('2d'), false)
	// })





	// TODO: gaussian blur


	
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

//window.onload = preinit;