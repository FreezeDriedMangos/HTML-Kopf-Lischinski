
//
// parameters
//

const inputImageElementID = 'my-image';

const ISLAND_SCORE = 13
const AREA_SCORE_WEIGHT = 1


var pixelSize = 10 // basically the upscale factor

var palletteOverrides = {}

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

function lerp(a, b, t) {
	return (1-t)*a + t*b
}

// https://stackoverflow.com/a/5624139/9643841
function componentToHex(c) {
	var hex = c.toString(16);
	return hex.length == 1 ? "0" + hex : hex;
}
function rgbToHex(r, g, b, a) {
	return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b) + componentToHex(a);
}

function invertRGB(r, g, b, a) {
	return [255-r, 255-g, 255-b, a]
}

// https://stackoverflow.com/a/17934865
function RGBtoYUV(r, g, b, a=255) {
	const y = Math.floor( 0.257 * r + 0.504 * g + 0.098 * b +  16);
	const u = Math.floor(-0.148 * r - 0.291 * g + 0.439 * b + 128);
	const v = Math.floor( 0.439 * r - 0.368 * g - 0.071 * b + 128);
	return [y, u, v, a]
}

// https://stackoverflow.com/a/54070620
function rgb2hsv(r,g,b) {
	r /= 255
	g /= 255
	b /= 255

	let v=Math.max(r,g,b), c=v-Math.min(r,g,b);
	let h= c && ((v==r) ? (g-b)/c : ((v==g) ? 2+(b-r)/c : 4+(r-g)/c)); 
	return [60*(h<0?h+6:h), v&&c/v, v];
}


function differentColors(yuv1, yuv2) {
	if (palletteOverrides[yuv1.toString()] && palletteOverrides[yuv1.toString()][yuv2.toString()] != undefined) 
		return palletteOverrides[yuv1.toString()][yuv2.toString()] >= 1

	if (yuv1[3] !== undefined || yuv2[3] !== undefined) // if they have alpha components
		if ((yuv1[3] === 0) !== (yuv2[3] === 0)) return true; // if one is completely transparent and the other is not, the pixels are automatically considered dissimilar

	var dy = Math.abs(yuv1[0]-yuv2[0]) > 0;
	var du = Math.abs(yuv1[1]-yuv2[1]) > 0 ;
	var dv = Math.abs(yuv1[2]-yuv2[2]) > 0 ;
	return dy || du || dv;	
}

function dissimilarColors(yuv1, yuv2) {
	if (palletteOverrides[yuv1.toString()] && palletteOverrides[yuv1.toString()][yuv2.toString()] != undefined) 
		return palletteOverrides[yuv1.toString()][yuv2.toString()] >= 2

	if (yuv1[3] !== undefined || yuv2[3] !== undefined) // if they have alpha components
		if ((yuv1[3] === 0) !== (yuv2[3] === 0)) return true; // if one is completely transparent and the other is not, the pixels are automatically considered dissimilar

	var dy = Math.abs(yuv1[0]-yuv2[0]) > 48;
	var du = Math.abs(yuv1[1]-yuv2[1]) > 7 ;
	var dv = Math.abs(yuv1[2]-yuv2[2]) > 6 ;

	return dy || du || dv;	
}

function veryDissimilarColors(yuv1, yuv2) {
	if (palletteOverrides[yuv1.toString()] && palletteOverrides[yuv1.toString()][yuv2.toString()] != undefined) 
		return palletteOverrides[yuv1.toString()][yuv2.toString()] >= 3

	if (yuv1[3] !== undefined || yuv2[3] !== undefined) // if they have alpha components
		if ((yuv1[3] === 0) !== (yuv2[3] === 0)) return true; // if one is completely transparent and the other is not, the pixels are automatically considered dissimilar

	var dy = Math.abs(yuv1[0]-yuv2[0]) > 100;
	var du = Math.abs(yuv1[1]-yuv2[1]) > 100;
	var dv = Math.abs(yuv1[2]-yuv2[2]) > 100;
	return dy || du || dv;	
}

function dissimilarityScore(yuv1, yuv2) {
	if (!differentColors(yuv1, yuv2)) return 0 // literally the same

	if (veryDissimilarColors(yuv1, yuv2)) return 3 // very dissimilar
	if (dissimilarColors(yuv1, yuv2)) return 2 // dissimilar
	return 1 // similar
}

//
// Raster functions
//

function initRaster(width = 300, height = 300, parentElementId=undefined) {
	var rasterCanvas = document.createElement('canvas');
	rasterCanvas.width = width;
	rasterCanvas.height = height;

	if (parentElementId) document.getElementById(parentElementId).appendChild(rasterCanvas)
	else document.body.appendChild(rasterCanvas);

	return rasterCanvas
}

//
// SVG functions
//

// https://stackoverflow.com/a/8215105/9643841
function initSVG(width = 300, height = 300, parentElementId=undefined) {
	var svg = document.createElementNS(svgns, "svg");
	svg.setAttribute('width', width);
	svg.setAttribute('height', height);
	
	if (parentElementId) document.getElementById(parentElementId).appendChild(svg)
	else document.body.appendChild(svg);

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

function makePolygon(svg, points, color="#000000", strokeWidth=0.1) {
	var polygon = document.createElementNS( svgns,'polygon' );
	polygon.setAttributeNS( null,'points', points.map(([x, y]) => x+","+y).join(" ") );
	if (color) polygon.setAttributeNS( null,'fill',color );
	if (color && strokeWidth) { polygon.setAttributeNS( null,'stroke',color ); polygon.setAttributeNS( null,'stroke-width',String(strokeWidth) ); }
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

// some data that should be available globally
var getPixelData = (x, y) => [0, 0, 0, 0]
var imgWidth = 0;
var imgHeight = 0;

// what to do when an image is loaded (set by whatever page is open)
var onInit = () => {}

function init() {
	// https://stackoverflow.com/a/8751659/9643841
	var canvas = null;
	
	function loadImage() {
		var img = document.getElementById(inputImageElementID);
		
		// draw the input image to a canvas so the pixel data can be read, 
		// and also add a ring of alpha pixels around the edge to prevent edge cases later down the road
		canvas = document.createElement('canvas');
		imgWidth = canvas.width = img.width+2;
		imgHeight = canvas.height = img.height+2;
		canvas.getContext('2d').imageSmoothingEnabled = false
		canvas.getContext('2d').drawImage(img, 1, 1, img.width, img.height);
		console.log({imgWidth, imgHeight})

		// TODO: make an imageWidth+2 by imageHeight+2 array and fill it with the colors of the image, the 1 pixel wide ring on the edges should be filled with [0,0,0,0]
		// then make getPixelData read from this array
		// lastly, actually add 2 to the stored values of imageWidth/imageHeight so they reflect the size of the new array
	}
	getPixelData = (x, y) => {
		return canvas.getContext('2d').getImageData(x, y, 1, 1).data;
	}
	loadImage();

	onInit()
	
	console.log('DONE!')
	document.getElementById("warning").innerHTML+= "Processing is complete!"
}

//window.onload = preinit;

function getPallette() {
	const pallette = {}
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			const rgba = getPixelData(x, y)
			pallette[rgbToHex(...rgba)] = rgba
		}
	}

	const retval = Object.values(pallette)
	retval.sort((c1, c2) => rgb2hsv(...c1)[0] - rgb2hsv(...c2)[0]) // sort by hue
	return retval
}

//
//
// More complex draw functions
//
//

function drawPallette(pallette, parentElementId = undefined, palletteSwatchSize = 10) {
	const palletteParent = parentElementId ? document.getElementById(parentElementId) : document.createElement('div')
	if (!parentElementId) document.body.appendChild(palletteParent)

	pallette.forEach(color => {
		const swatch = document.createElement('div');

		swatch.style.minWidth = swatch.style.maxWidth = palletteSwatchSize
		swatch.style.minHeight = swatch.style.maxHeight = palletteSwatchSize
		swatch.style.margin = '5px'
		swatch.style.border = 'black solid 1px'
		swatch.style.backgroundColor = rgbToHex(...color)

		palletteParent.appendChild(swatch)
	})
}

function drawSimilarityGrid(pallette, parentElementId = undefined, palletteSwatchSize = 10, clickCallback = ()=>{}) {
	const palletteParent = parentElementId ? document.getElementById(parentElementId) : document.createElement('div')
	if (!parentElementId) document.body.appendChild(palletteParent)

	// set up the grid
	palletteParent.style.display = 'grid',
	palletteParent.style.gridTemplateColumns = pallette.reduce((snowball, snow) => snowball + palletteSwatchSize + " ", ""),
	palletteParent.style.gap = '2px'
	palletteParent.style.columnCount = pallette.length+1
	palletteParent.style.width = 'fit-content'

	// utility function
	const createSwatch = (color, r, c) => {
		const swatch = document.createElement('div')
		swatch.style.minWidth = swatch.style.maxWidth = palletteSwatchSize
		swatch.style.minHeight = swatch.style.maxHeight = palletteSwatchSize
		swatch.style.border = (color.length >= 9 && color.substring(7, 9) === '00') ? 'lightgrey solid 1px' : 'black solid 1px'
		swatch.style.backgroundColor = color
		swatch.style.aspectRatio = 1
		swatch.style.gridRow = r
		swatch.style.gridColumn = c

		return swatch
	}

	// fill the empty corner of the comparison grid
	const emptyCorner = createSwatch('#00000000', 1, 1)
	emptyCorner.style.border = '1px solid white'
	palletteParent.appendChild(emptyCorner)

	// top row
	pallette.forEach((color, c) => palletteParent.appendChild(createSwatch(rgbToHex(...color), 1, c+2)) )

	
	// each subsequent row
	pallette.forEach((color, r) => {
		palletteParent.appendChild(createSwatch(rgbToHex(...color), r+2, 1))
		const yuvColor = RGBtoYUV(...color)

		// similarity chart
		pallette.forEach((otherColor, c) => {
			// only generate half of the chart, skip the duplicates
			if ( c < r ) {
				const placeholderSwatch = createSwatch('#ffffff', r+2, c+2)
				placeholderSwatch.style.border = '1px solid white'
				palletteParent.appendChild(placeholderSwatch)
				return
			}


			const yuvOtherColor = RGBtoYUV(...otherColor)

			const dissimilarity = dissimilarityScore(yuvColor, yuvOtherColor)
			var similarity = '#ff00ff'
			switch (dissimilarity) {
				case 0: similarity = '#ffffff'; break
				case 1: similarity = '#ffff00'; break
				case 2: similarity = '#ffaa00'; break
				case 3: similarity = '#ff0000'; break
			}

			const similaritySwatch = createSwatch(similarity, r+2, c+2)
			similaritySwatch.style.border = '1px solid white'
			similaritySwatch.onclick = () => clickCallback(yuvColor, yuvOtherColor, similaritySwatch)
			palletteParent.appendChild(similaritySwatch)
		})
	})
}

function drawInputToSVGCanvas(svgCanvas, imgWidth, imgHeight, yuvImage=undefined) {
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			if(yuvImage && yuvImage[x][y][3] <= 0) continue; // if a yuvImage is provided, skip this pixel if v is 0 or less

			makeSquare(svgCanvas, x*pixelSize, y*pixelSize, pixelSize, rgbToHex(...getPixelData(x, y)))
			// var c = makeCircle(svgCanvas, x*pixelSize, y*pixelSize, 2*pixelSize, rgbToHex(...getPixelData(x, y)))
			// c.setAttributeNS(null, 'style', "mix-blend-mode: soft-light");
		}
	}
}

function drawSimilarityGraphToSVGCanvas(svgCanvas, imgWidth, imgHeight, similarityGraph ) {
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			for (var i = 0; i < deltas.length; i++) {
				if (similarityGraph[x][y][i] == false) continue;

				var delta = deltas[i]

				var newX = x + delta[0]
				var newY = y + delta[1]

				makeLine(
					svgCanvas, 
					x*pixelSize+pixelSize/2, 
					y*pixelSize+pixelSize/2, 
					newX*pixelSize+pixelSize/2, 
					newY*pixelSize+pixelSize/2, 
					invertRGB(...getPixelData(x, y))
				)
			}
		}
	}
}

function drawVoronoiToSVGCanvas(svgCanvas, imgWidth, imgHeight, voronoiVerts, voronoiCellVertexPositions) {
	for (var x = 0; x < imgWidth; x++) {
		for (var y = 0; y < imgHeight; y++) {
			makePolygon(svgCanvas, voronoiVerts[x][y].map(v => voronoiCellVertexPositions[v]).map(([dx, dy]) => [x+dx, y+dy]).map(([x, y]) => [pixelSize*x, pixelSize*y]), rgbToHex(...getPixelData(x, y)))
		}
	}
}

function drawSplinesToSVGCanvas(svgCanvas, { packagedSplinePrototypes, splines, adjacencyList, pointsThatArePartOfContouringSplines, pointsThatArePartOfGhostSplines } ) {
	// draw all adjacencies (this highlights edges that were missed when building splines)
	Object.keys(adjacencyList).forEach(globalPointIndex => {
		var point = globallyUniqueIndex_to_absoluteXY(globalPointIndex).map(x_or_y => pixelSize*x_or_y)
		var points = adjacencyList[globalPointIndex].map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
		for(var i = 0; i < points.length; i++) {
			var color = [Math.floor(Math.random()*150)+50, Math.floor(Math.random()*150)+50, Math.floor(Math.random()*150)+50]
			makeLine(svgCanvas, ...point, ...points[i], color)
		}
	})
	
	// draw splines approximation
	packagedSplinePrototypes.forEach(packagedSplinePrototype => {
		const splinePointIndexes = packagedSplinePrototype.points
		var color = packagedSplinePrototype.isContouringSpline
			? [0,0,0] 
			: packagedSplinePrototype.isGhostSpline
				? [220,220,220]
				: [70,70,180]
		
		var points = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i).map(x_or_y => pixelSize*x_or_y))
		for(var i = 0; i < points.length-1; i++) {
			makeLine(svgCanvas, ...points[i], ...points[i+1], color)
		}
	})
}

function drawSplinesToRasterCanvas(rasterCanvas, { packagedSplinePrototypes, splines, pointsThatArePartOfContouringSplines, pointsThatArePartOfGhostSplines }) {
	packagedSplinePrototypes.forEach(packagedSplinePrototype => {
		const splinePointIndexes = packagedSplinePrototype.points

		var absolutePoints = splinePointIndexes.map(i => globallyUniqueIndex_to_absoluteXY(i))
		var absolutePoints_scaled = absolutePoints.map(point => [pixelSize*point[0], pixelSize*point[1]])
		
		var color = packagedSplinePrototype.isContouringSpline
			? [0,0,0] 
			: packagedSplinePrototype.isGhostSpline
				? [220,220,220]
				: [70,70,180]
		
		const splineObject = new ClampedClosedBSpline(4, absolutePoints_scaled)
		splineObject.drawToCanvas(rasterCanvas.getContext('2d'), false, color=color)
	})
}

function drawSplineObjectsToRasterCanvas(rasterCanvas, {splineObjects}) {
	// var context = rasterCanvas.getContext('2d')

	splineObjects.forEach(splineObject => {
		var color = splineObject.isContouringSpline
			? [0,0,0] 
			: splineObject.isGhostSpline
				? [220,220,220]
				: [70,70,180]

		splineObject.drawToCanvas(rasterCanvas.getContext('2d'), false, color, pixelSize)

		// draw start and end points for debugging

		// context.beginPath();
		// context.arc(splineObject.points[0][0]*pixelSize, splineObject.points[0][1]*pixelSize, 3, 0, 2 * Math.PI, false);
		// context.fillStyle = 'green';
		// context.fill();

		
		// context.beginPath();
		// context.arc(splineObject.points[splineObject.points.length-1][0]*pixelSize, splineObject.points[splineObject.points.length-1][1]*pixelSize, 3, 0, 2 * Math.PI, false);
		// context.fillStyle = 'blue';
		// context.fill();
	})
}