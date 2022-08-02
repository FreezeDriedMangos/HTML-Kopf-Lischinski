// this is my BSpline class, using thibauts' bspline evaluation function

// I can't figure out how to get require to work, so whatever, I'll fake it
//const thibauts_bspline = require('lib/b-spline') // https://github.com/thibauts/b-spline
const thibauts_bspline = {interpolate}

class BSpline {
	constructor(degree, points, knotVector=null, weights=null) {
		// automatically detect closed splines and fix the input to handle them
		// note: have to change the span function when doing integrals later in this case
		this.closed = false
		const start = points[0]
		const end = points[points.length-1]
		if (start[0] === end[0] && start[1] === end[1]) {
			// to make a closed BSpline, you just need to wrap `degree` number of points at the start and the end
			// https://math.stackexchange.com/questions/1296954/b-spline-how-to-generate-a-closed-curve-using-uniform-b-spline-curve
			this.closed = true
			const newPoints = [...points]
			for (var i = 0; i < degree; i++) {
				newPoints.unshift(points[points.length-(degree-i)])
				newPoints.push(points[i])
				if(!Array.isArray(points[i])) console.error('non point point')
			}
			console.log(this.closed)
			
			if (!knotVector) {
				knotVector = []
				for(i=-degree; i < newPoints.length+1; i++) {
					knotVector.push(i/points.length)
				}
				console.log(knotVector)
			}

			points = newPoints
		} else {
			// TODO: make it a clamped b spline
			// https://pages.mtu.edu/%7Eshene/COURSES/cs3621/NOTES/spline/bspline-curve-prop.html
			
			const newPoints = [...points]
			for (var i = 0; i < degree; i++) {
				newPoints.push(points[points.length-1])
				newPoints.unshift(points[0])
			}
			points = newPoints
		}

		this.degree = degree
		this.points = points
		this.knotVector = knotVector
		this.weights = weights // defaults to all 1's
	}

	evaluate(t) {
		return thibauts_bspline.interpolate(t, this.degree, this.points, this.knotVector, this.weights, null)
	}

	
	derrivative() {
		// function based off of vvanirudh's version found here https://github.com/vvanirudh/Pixel-Art/blob/master/src/depixelizer/geometry/bspline.py
		if (this.cachedDerrivative) return this.cachedDerrivative

		const newPoints = []
		for(var i = 0; i < this.points.length-1; i++) {
			const coeff = this.degree / (this.knotVector[i+1+p] - this.knotVector[i+1])
			newPoints.push([
				coeff * (this.points[i+1][0]-self.points[i][0]),
				coeff * (this.points[i+1][1]-self.points[i][1])
			]) 
		}

		const newKnotVector = this.knotVector.slice(1, this.knotVector.length-1)
		this.cachedDerrivative = new BSpline(degree-1, newPoints, newKnotVector)

		return this.cachedDerrivative
	}

	// returns the curvature at t
	curvature(t) {
		const d1 = this.derrivative().evaluate(t)
		const d2 = this.derrivative().derrivative().evaluate(t)
		const numerator = d1[0]*d2[1] - d1[1]*d2[0]
		const denominatorPre = d1[0]*d1[0] + d1[y]*d1[y]
		
		if (denominatorPre == 0) return 0
		const denominator = Math.pow(Math.sqrt(denominatorPre), 3)

		return Mathf.abs(numerator/denominator)
	}
}