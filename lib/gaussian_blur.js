// modified from https://fiveko.com/gaussian-filter-in-pure-javascript/


function makeGaussKernel(sigma){
  const GAUSSKERN = 6.0;
  var dim = parseInt(Math.max(3.0, GAUSSKERN * sigma));
  var sqrtSigmaPi2 = Math.sqrt(Math.PI*2.0)*sigma;
  var s2 = 2.0 * sigma * sigma;
  var sum = 0.0;
  
  var kernel = new Float32Array(dim - !(dim & 1)); // Make it odd number
  const half = parseInt(kernel.length / 2);
  for (var j = 0, i = -half; j < kernel.length; i++, j++) 
  {
    kernel[j] = Math.exp(-(i*i)/(s2)) / sqrtSigmaPi2;
    sum += kernel[j];
  }
  // Normalize the gaussian kernel to prevent image darkening/brightening
  for (var i = 0; i < dim; i++) {
    kernel[i] /= sum;
  }
  return kernel;
}

// /**
// * Internal helper method
// * @param pixels - the Canvas pixles
// * @param kernel - the Gaussian blur kernel
// * @param ch - the color channel to apply the blur on
// * @param gray - flag to show RGB or Grayscale image
// */
// function gauss_internal(pixels, kernel, ch, gray){
//   var data = pixels.data;
//   var w = pixels.width;
//   var h = pixels.height;
//   var buff = new Uint8Array(w*h); 
//   var abuff = new Uint8Array(w*h); 
//   var mk = Math.floor(kernel.length / 2);
//   var kl = kernel.length;
//   var ach = 3; // alpha channel index
  
//   // First step process columns
//   for (var j = 0, hw = 0; j < h; j++, hw += w) 
//   {
//     for (var i = 0; i < w; i++)
//     {
//       var sum = 0;
//       var asum = 0;
//       for (var k = 0; k < kl; k++)
//       {
//         var col = i + (k - mk);
//         col = (col < 0) ? 0 : ((col >= w) ? w - 1 : col);
//         // sum += data[(hw + col)*4 + ch]*kernel[k];
//         // var alphaComp = data[(hw + col)*4 + ach]/(255*kl) // account for alpha https://stackoverflow.com/a/10271092
//         // sum += data[(hw + col)*4 + ch]*kernel[k] * (ch===ach ? 1 : alphaComp);
//         sum += data[(hw + col)*4 + ch]*kernel[k] + (ch===ach ? 0 : (255-data[(hw + col)*4 + ach]))
//         asum += data[(hw + col)*4 + ach]*kernel[k]
//       }
//       buff[hw + i] = sum;
//       abuff[hw + i] = asum;
//     }
//   }
  
//   // Second step process rows
//   for (var j = 0, offset = 0; j < h; j++, offset += w) 
//   {
//     for (var i = 0; i < w; i++)
//     {
//       var sum = 0;
//       for (k = 0; k < kl; k++)
//       {
//         var row = j + (k - mk);
//         row = (row < 0) ? 0 : ((row >= h) ? h - 1 : row);
//         sum += buff[(row*w + i)]*kernel[k] + (ch===ach ? 0 : (255-abuff[(row*w + i)]));
//       }
//     //   sum *= (ch===ach ? 1 : kl)
//       var off = (j*w + i)*4;
//       (!gray) ? data[off + ch] = sum : 
//                 data[off] = data[off + 1] = data[off + 2] = sum;
//     }
//   }
// }

// /**
// * Gaussian blur example
// * @param canvas - HTML5 Canvas element
// * @sigma sigma - the standard deviation
// */
// function gauss(canvas, sigma){
//   var context = canvas.getContext('2d');
//   var pixels = context.getImageData(0, 0, canvas.width,canvas.height);
//   var kernel = makeGaussKernel(sigma);
  
//   // Blur a cahnnel (RGB or Grayscale)
//   for (var ch = 0; ch <= 3; ch++){
//     gauss_internal(pixels, kernel, ch, false);
//   }
//   // Apply the modified pixels
//   context.putImageData(pixels, 0, 0);
// }


/**
* Internal helper method
* @param pixels - the Canvas pixles
* @param kernel - the Gaussian blur kernel
* @param ch - the color channel to apply the blur on
* @param gray - flag to show RGB or Grayscale image
*/
function gauss_internal(pixels, kernel, ch, gray){
    var data = pixels.data;
    var w = pixels.width;
    var h = pixels.height;
    var buff = new Uint8Array(w*h); 
    var abuff = new Uint8Array(w*h); 
    var mk = Math.floor(kernel.length / 2);
    var kl = kernel.length;
    var ach = 3; // alpha channel index
    
    // First step process columns
    for (var j = 0, hw = 0; j < h; j++, hw += w) 
    {
      for (var i = 0; i < w; i++)
      {
        var sum = 0;
        var asum = 0;
        for (var k = 0; k < kl; k++)
        {
          var col = i + (k - mk);
          col = (col < 0) ? 0 : ((col >= w) ? w - 1 : col);
          // sum += data[(hw + col)*4 + ch]*kernel[k];
          // var alphaComp = data[(hw + col)*4 + ach]/(255*kl) // account for alpha https://stackoverflow.com/a/10271092
          // sum += data[(hw + col)*4 + ch]*kernel[k] * (ch===ach ? 1 : alphaComp);
          var a = (Number(data[(hw + col)*4 + ach]) / 255)*Number(kernel[k])
          sum += Number(data[(hw + col)*4 + ch]*kernel[k]) * (ch===ach ? 1 : a)
          asum += a
        }
        // buff[hw + i] = sum / (ch===ach ? 1 : asum);
        buff[hw + i] = sum * (ch===ach ? 1 : (kl-asum)/kl); // STRUGGLE
        abuff[hw + i] = asum*255;
      }
    }

    // 
    // a*1 + b*0 + c*0  /  1+0+0
    // a*1 + b*0 + c*0  *  3
    // a*1 + b*0 + c*0  *  3/(1+0+0)
    //
    // 255*a + 255*b + 255*c   /   (1-a + 1-b + 1-c)
    // 255*(0.5 + 0.1 + 0.3) / (0.5 + 0.9 + 0.7) 
    // 255*(0.5 + 0.1 + 0.3) * (3-(0.5 + 0.1 + 0.3)) 
    
    // Second step process rows
    for (var j = 0, offset = 0; j < h; j++, offset += w) 
    {
      for (var i = 0; i < w; i++)
      {
        var sum = 0;
        for (k = 0; k < kl; k++)
        {
          var row = j + (k - mk);
          row = (row < 0) ? 0 : ((row >= h) ? h - 1 : row);
          sum += buff[(row*w + i)]*kernel[k];
        }
      //   sum *= (ch===ach ? 1 : kl)
        var off = (j*w + i)*4;
        (!gray) ? data[off + ch] = sum : 
                  data[off] = data[off + 1] = data[off + 2] = sum;
      }
    }
  }
  
  /**
  * Gaussian blur example
  * @param canvas - HTML5 Canvas element
  * @sigma sigma - the standard deviation
  */
  function gauss(canvas, sigma){
    var context = canvas.getContext('2d');
    var pixels = context.getImageData(0, 0, canvas.width,canvas.height);
    var kernel = makeGaussKernel(sigma);
    
    // Blur a cahnnel (RGB or Grayscale)
    for (var ch = 0; ch <= 3; ch++){
      gauss_internal(pixels, kernel, ch, false);
    }
    // Apply the modified pixels
    context.putImageData(pixels, 0, 0);
  }