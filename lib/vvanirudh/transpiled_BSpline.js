import { sqrt } from 'math';
import { Point } from './point';

//
// Original python code by vvanirudh from https://github.com/vvanirudh/Pixel-Art/blob/d581b0b56b80ad7dac3cb44a26642a0ffdd49ff9/src/depixelizer/geometry/bspline.py#L7
// Transpiled using https://extendsclass.com/python-to-javascript.html
//

var _pj;

function _pj_snippets(container) {
  function _assert(comp, msg) {
    function PJAssertionError(message) {
      this.name = "PJAssertionError";
      this.message = message || "Custom error PJAssertionError";

      if (typeof Error.captureStackTrace === "function") {
        Error.captureStackTrace(this, this.constructor);
      } else {
        this.stack = new Error(message).stack;
      }
    }

    PJAssertionError.prototype = Object.create(Error.prototype);
    PJAssertionError.prototype.constructor = PJAssertionError;
    msg = msg || "Assertion failed.";

    if (!comp) {
      throw new PJAssertionError(msg);
    }
  }

  container["_assert"] = _assert;
  return container;
}

_pj = {};

_pj_snippets(_pj);

class BSpline extends object {
  constructor(KnotVector, points, degree = null) {
    var expected_degree;
    this.KnotVector = tuple(KnotVector);

    this._points = function () {
      var _pj_a = [],
          _pj_b = points;

      for (var _pj_c = 0, _pj_d = _pj_b.length; _pj_c < _pj_d; _pj_c += 1) {
        var p = _pj_b[_pj_c];

        _pj_a.push(new Point(p));
      }

      return _pj_a;
    }.call(this);

    expected_degree = this.KnotVector.length - this._points.length - 1;

    if (degree === null) {
      degree = expected_degree;
    }

    if (degree !== expected_degree) {
      throw new ValueError("Degree expected is %s, got %s instead as Input." % [expected_degree, degree]);
    }

    this.degree = degree;
    this.remove_stored();
  }

  remove_stored() {
    this.storedvalue = {};
  }

  Move(i, value) {
    this._points[i] = value;
    this.remove_stored();
  }

  toString() {
    return "<%s degree=%s, points=%s, KnotVector=%s>" % [Object.getPrototypeOf(this).__name__, this.degree, this.points.length, this.KnotVector.length];
  }

  copy() {
    return Object.getPrototypeOf(this)(this.KnotVector, this.points, this.degree);
  }

  get domain() {
    return [this.KnotVector[this.degree], this.KnotVector[this.KnotVector.length - this.degree - 1]];
  }

  get points() {
    return tuple(this._points);
  }

  get useful_points() {
    return this.points;
  }

  __call__(u) {
    var a, k, ps, s, uk;

    s = function () {
      var _pj_a = [],
          _pj_b = this.KnotVector;

      for (var _pj_c = 0, _pj_d = _pj_b.length; _pj_c < _pj_d; _pj_c += 1) {
        var uk = _pj_b[_pj_c];

        if (uk === u) {
          _pj_a.push(uk);
        }
      }

      return _pj_a;
    }.call(this).length;

    for (var tup, _pj_c = 0, _pj_a = enumerate(this.KnotVector), _pj_b = _pj_a.length; _pj_c < _pj_b; _pj_c += 1) {
      tup = _pj_a[_pj_c];
      [k, uk] = tup;

      if (uk >= u) {
        break;
      }
    }

    if (s === 0) {
      k -= 1;
    }

    if (this.degree === 0) {
      if (k === this.points.length) {
        k -= 1;
      }

      return this.points[k];
    }

    ps = [dict(zip(range(k - this.degree, k - s + 1), this.points.slice(k - this.degree, k - s + 1)))];

    for (var r = 1, _pj_a = this.degree - s + 1; r < _pj_a; r += 1) {
      ps.append({});

      for (var i = k - this.degree + r, _pj_b = k - s + 1; i < _pj_b; i += 1) {
        a = (u - this.KnotVector[i]) / (this.KnotVector[i + this.degree - r + 1] - this.KnotVector[i]);
        ps[r][i] = (1 - a) * ps[r - 1][i - 1] + a * ps[r - 1][i];
      }
    }

    return ps.slice(-1)[0][k - s];
  }

  *Quadratic_Bezier_Fit() {
    var control_points, cp, ocp0, ocp1, on_curve_points;

    _pj._assert(this.degree === 2, null);

    control_points = this.points.slice(1, -1);

    on_curve_points = function () {
      var _pj_a = [],
          _pj_b = this.KnotVector.slice(2, -2);

      for (var _pj_c = 0, _pj_d = _pj_b.length; _pj_c < _pj_d; _pj_c += 1) {
        var u = _pj_b[_pj_c];

        _pj_a.push(this(u));
      }

      return _pj_a;
    }.call(this);

    ocp0 = on_curve_points[0];

    for (var tup, _pj_c = 0, _pj_a = zip(control_points, on_curve_points.slice(1)), _pj_b = _pj_a.length; _pj_c < _pj_b; _pj_c += 1) {
      tup = _pj_a[_pj_c];
      [cp, ocp1] = tup;
      yield [ocp0.tuple, cp.tuple, ocp1.tuple];
      ocp0 = ocp1;
    }
  }

  Derivative() {
    var cached, coeff, new_points, p;
    cached = this.storedvalue.get("1");

    if (cached) {
      return cached;
    }

    new_points = [];
    p = this.degree;

    for (var i = 0, _pj_a = this.points.length - 1; i < _pj_a; i += 1) {
      coeff = p / (this.KnotVector[i + 1 + p] - this.KnotVector[i + 1]);
      new_points.append(coeff * (this.points[i + 1] - this.points[i]));
    }

    cached = new BSpline(this.KnotVector.slice(1, -1), new_points, p - 1);
    this.storedvalue["1"] = cached;
    return cached;
  }

  Clamp(value) {
    return max(this.domain[0], min(this.domain[1], value));
  }

  Span(index) {
    return [new this.Clamp(this.KnotVector[index]), new this.Clamp(this.KnotVector[index + 1])];
  }

  Points_In_Span(index) {
    return function () {
      var _pj_a = [],
          _pj_b = range(this.degree);

      for (var _pj_c = 0, _pj_d = _pj_b.length; _pj_c < _pj_d; _pj_c += 1) {
        var i = _pj_b[_pj_c];

        _pj_a.push(new this.Span(index + i));
      }

      return _pj_a;
    }.call(this);
  }

  Integrate_part(func, span, intervals) {
    var interval, result;

    if (span[0] === span[1]) {
      return 0;
    }

    interval = (span[1] - span[0]) / intervals;
    result = (func(span[0]) + func(span[1])) / 2;

    for (var i = 1, _pj_a = intervals; i < _pj_a; i += 1) {
      result += func(span[0] + i * interval);
    }

    result *= interval;
    return result;
  }

  Integrate(index, func, intervals) {
    var s, spans, spans_;
    spans = new this.Points_In_Span(index);

    spans = function () {
      var _pj_a = [],
          _pj_b = spans;

      for (var _pj_c = 0, _pj_d = _pj_b.length; _pj_c < _pj_d; _pj_c += 1) {
        var span = _pj_b[_pj_c];

        if (span[0] !== span[1]) {
          _pj_a.push(span);
        }
      }

      return _pj_a;
    }.call(this);

    s = 0;

    for (var span, _pj_c = 0, _pj_a = spans, _pj_b = _pj_a.length; _pj_c < _pj_b; _pj_c += 1) {
      span = _pj_a[_pj_c];
      s += new this.Integrate_part(func, span, intervals);
    }

    return s;
  }

  Curvature(u) {
    var d1, d2, denominator, numerator;
    d1 = new this.Derivative()(u);
    d2 = new new this.Derivative().Derivative()(u);
    numerator = d1.x * d2.y - d1.y * d2.x;
    denominator = Math.pow(sqrt(Math.pow(d1.x, 2) + Math.pow(d1.y, 2)), 3);

    if (denominator === 0) {
      return 0;
    }

    return abs(numerator / denominator);
  }

  Energy_C(index, intervals_per_span) {
    return new this.Integrate(index, this.Curvature, intervals_per_span);
  }

  reversed() {
    var arr;
    arr = [];

    for (var k, _pj_c = 0, _pj_a = reversed(this.KnotVector), _pj_b = _pj_a.length; _pj_c < _pj_b; _pj_c += 1) {
      k = _pj_a[_pj_c];
      arr.append(1 - k);
    }

    return Object.getPrototypeOf(this)(arr, reversed(this._points), this.degree);
  }

}

class Closed_BSpline extends BSpline {
  constructor(KnotVector, points, degree = null) {
    super(KnotVector, points, degree);

    this._unwrapped_len = this._points.length - this.degree;
    new this.Wrap_check();
  }

  Wrap_check() {
    if (this._points.slice(0, this.degree) !== this._points.slice(-this.degree)) {
      throw new ValueError("Points not wrapped at degree %s." % [this.degree]);
    }
  }

  Move(index, value) {
    if (!(0 <= index && index < this._points.length)) {
      throw new IndexError(index);
    }

    index = index % this._unwrapped_len;
    super.Move(index, value);

    if (index < this.degree) {
      super.Move(index + this._unwrapped_len, value);
    }
  }

  get useful_points() {
    return this.points.slice(0, -this.degree);
  }

  Span(index) {
    var d0, d1;
    var span;

    span = i => {
      return [this.KnotVector[i], this.KnotVector[i + 1]];
    };

    [d0, d1] = span(index);

    if (d0 < this.domain[0]) {
      [d0, d1] = span(index + this.points.length - this.degree);
    } else {
      if (d1 > this.domain[1]) {
        [d0, d1] = span(index + this.degree - this.points.length);
      }
    }

    return [new this.Clamp(d0), new this.Clamp(d1)];
  }

}

function Curve2Closed_BSpline(path, degree = 2) {
  var KnotVector, m, points;
  points = path + path.slice(0, degree);
  m = points.length + degree;

  KnotVector = function () {
    var _pj_a = [],
        _pj_b = range(m + 1);

    for (var _pj_c = 0, _pj_d = _pj_b.length; _pj_c < _pj_d; _pj_c += 1) {
      var i = _pj_b[_pj_c];

      _pj_a.push(Number.parseFloat(i) / m);
    }

    return _pj_a;
  }.call(this);

  return new Closed_BSpline(KnotVector, points, degree);
}

function magnitude(point) {
  return sqrt(Math.pow(point[0], 2) + Math.pow(point[2], 2));
}
