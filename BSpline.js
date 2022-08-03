// this is my BSpline class, using thibauts' bspline evaluation function

// I can't figure out how to get require to work, so whatever, I'll fake it
//const thibauts_bspline = require('lib/b-spline') // https://github.com/thibauts/b-spline
const thibauts_bspline = {interpolate}

// acts like a clamped or closed bspline depending on the points passed in. if the first is the same as the last, it's a closed bspline. otherwise it's a clamped bspline
class ClampedClosedBSpline {
	constructor(degree, points) {
		// automatically detect closed splines and fix the input to handle them
		// note: have to change the span function when doing integrals later in this case
		this.closed = false
		const start = points[0]
		const end = points[points.length-1]
		var knotVector = []
		if (start[0] === end[0] && start[1] === end[1] && points.length >= degree) { // can't have a closed spline that has fewer points than the degree, because that's an edge case and I don't want to implement it
			// to make a closed BSpline, you just need to wrap `degree` number of points at the start and the end
			// https://math.stackexchange.com/questions/1296954/b-spline-how-to-generate-a-closed-curve-using-uniform-b-spline-curve
			
			this.closed = true
			
			const newPoints = [...points]
			for (var i = 0; i < degree; i++) {
				newPoints.unshift(points[points.length-(i+1)])
				newPoints.push(points[i])
				if(!Array.isArray(points[i])) console.error('non point point')
				//if(!Array.isArray(points[i])) console.log(points[i])
			}	

			for(i=-degree; i < newPoints.length+1; i++) {
				knotVector.push(i/points.length)
			}

			points = newPoints
		} else {
			// clamped BSpline
			// https://pages.mtu.edu/%7Eshene/COURSES/cs3621/NOTES/spline/bspline-curve-prop.html
			
			const newPoints = [...points]
			for (var i = 0; i < degree; i++) {
				newPoints.push(points[points.length-1])
				newPoints.unshift(points[0])
			}
			points = newPoints

			for(i=-degree; i < newPoints.length+1; i++) {
				knotVector.push(i/points.length)
			}
		}

		this.degree = degree
		this.points = points
		this.knotVector = knotVector

		// this.weights = [] // using weights would complicate the curvature stuff, so we don't accept them in the constructor
		// for(var i = 0; i < this.points.length; i++) {
		// 	this.weights[i] = 1;
		// }
		this.weights = null
	}

	evaluate(t) {
		return thibauts_bspline.interpolate(t, this.degree, this.points, this.knotVector, this.weights, null)
	}

	// this function was made by modifying code from https://github.com/vvanirudh/Pixel-Art/blob/master/src/depixelizer/geometry/bspline.py
	derrivative() {
		// function based off of vvanirudh's version found here https://github.com/vvanirudh/Pixel-Art/blob/master/src/depixelizer/geometry/bspline.py
		if (this.cachedDerrivative != undefined) return this.cachedDerrivative

		var newPoints = []
		for(var i = 0; i < this.points.length-1; i++) {
			var coeff = this.degree / (this.knotVector[i+1+this.degree] - this.knotVector[i+1])
			
			newPoints.push([
				coeff * (this.points[i+1][0]-this.points[i][0]),
				coeff * (this.points[i+1][1]-this.points[i][1])
			]) 
		}

		var newKnotVector = this.knotVector.slice(1, this.knotVector.length-1)
		this.cachedDerrivative = new ClampedClosedBSpline(this.degree-1, newPoints)
		// since ClampedClosedBSpline automatically changes the points and knotvector arrays passed to it, but here we have the exact points array and knotvector we want, we have to manually set them both
		this.cachedDerrivative.knotVector = newKnotVector
		this.cachedDerrivative.points = newPoints 

		return this.cachedDerrivative
	}

	// returns the curvature at t
	// this function was made by modifying code from https://github.com/vvanirudh/Pixel-Art/blob/master/src/depixelizer/geometry/bspline.py
	curvature(t) {
		const d1 = this.derrivative().evaluate(t)
		const d2 = this.derrivative().derrivative().evaluate(t)
		const numerator = d1[0]*d2[1] - d1[1]*d2[0]
		const denominatorPre = d1[0]*d1[0] + d1[1]*d1[1]
		
		if (denominatorPre == 0) return 0
		const denominator = Math.pow(Math.sqrt(denominatorPre), 3)

		return Math.abs(numerator/denominator)
	}


	// ==================================================================================================
	//
	// Integration (all functions are considered private except IntegrateCurvature)
	//
	// ==================================================================================================

	Clamp(val) { return Math.max(0, Math.min(1, val)) }
	span(i) {
		return [this.knotVector[i], this.knotVector[i + 1]]
	}
	// span for clamped/closed bspline (since that's what this class always represents)
	Span(index) {

		var [d0, d1] = this.span(index)
		if (d0 < 0) {
			d0, d1 = this.span(index + this.points.length - this.degree)
		} else if (d1 > 1) {
			d0, d1 = this.span(index + this.degree - this.points.length)
		}

		return [this.Clamp(d0), this.Clamp(d1)]
	}
	Points_In_Span(index) {
		var points = []
		for (var i = 0; i < this.degree; i++)
			points.push(this.Span(index + i))
		return points
	}	
	Integrate_part(func, span, intervals) {
		//#   Integrates the given function on the Interval and returns value
		if (span[0] == span[1]) {
			return 0
		}

		const interval = (span[1] - span[0]) / intervals
		var result = (this.curvature(span[0]) + this.curvature(span[1])) / 2
		for (var i = 1; i < intervals; i++){
			result += this.curvature(span[0] + i * interval)
		}
		result *= interval

		return result
	}
	Integrate(index, func, intervals) {
		//# Integrates the function in intervals
		const spans_ = this.Points_In_Span(index)
		const spans = spans_.filter(span => span[0] != span[1]) // [span for span in spans_ if span[0] != span[1]]
		return spans.reduce((sum, span) => sum+this.Integrate_part(func, span, intervals), 0)
	}

	// these functions were made by modifying code from https://github.com/vvanirudh/Pixel-Art/blob/master/src/depixelizer/geometry/bspline.py
	IntegrateCurvature(index, intervals) {
		//const funcParam = this.curvature
		//funcParam.bind(this) // before passing an object's function as a parameter, you have to bind (just a js quirk?)
		return this.Integrate(index, this.curvature, intervals)
	}

	// =============================
	//
	// End Integration
	//
	// =============================

	
	// function from https://github.com/Tagussan/BSpline/blob/master/main.js
	drawToCanvas(ctx, drawPoints = false){

		//ctx.clearRect(0,0,canv.width,canv.height);
		const pts = this.points
		if(pts.length == 0) {
			return;
		}
		
		if (drawPoints){
			for(var i = 0;i<pts.length;i++){
				ctx.fillStyle = "rgba(0,255,0,10)";
				ctx.beginPath();
				ctx.arc(pts[i][0],pts[i][1],3,0,Math.PI*2,false);
				ctx.fill();
				ctx.closePath();   
			}
		}

		ctx.beginPath();
		var oldx,oldy,x,y;
		oldx = this.evaluate(0)[0];
		oldy = this.evaluate(0)[1];
		for(var t = 0;t <= 1;t+=0.001){
			ctx.moveTo(oldx,oldy);
			var interpol = this.evaluate(t);
			x = interpol[0];
			y = interpol[1];
			ctx.lineTo(x,y);
			oldx = x;
			oldy = y;
		}
		ctx.stroke();
		ctx.closePath();
	}
}