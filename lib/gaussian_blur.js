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


// /**
// * Internal helper method
// * @param pixels - the Canvas pixles
// * @param kernel - the Gaussian blur kernel
// * @param ch - the color channel to apply the blur on
// * @param gray - flag to show RGB or Grayscale image
// */
// function gauss_internal(pixels, kernel, ch, boundaries){
//     var data = pixels.data;
//     var w = pixels.width;
//     var h = pixels.height;
//     var buff = new Uint8Array(w*h); 
//     var abuff = new Uint8Array(w*h); 
//     var mk = Math.floor(kernel.length / 2);
//     var kl = kernel.length;
//     var ach = 3; // alpha channel index
    
//     Object.keys(boundaries).forEach(pixelIndex => {
//         boundaries[pixelIndex] = data.slice(pixelIndex*4, pixelIndex*4+4)
//     })

//     // First step process columns
//     for (var j = 0, hw = 0; j < h; j++, hw += w) 
//     {
//       for (var i = 0; i < w; i++)
//       {
//         var sum = 0;
//         var asum = 0;
//         for (var k = 0; k < kl; k++)
//         {
//           var col = i + (k - mk);
//           col = (col < 0) ? 0 : ((col >= w) ? w - 1 : col);
//           // sum += data[(hw + col)*4 + ch]*kernel[k];
//           // var alphaComp = data[(hw + col)*4 + ach]/(255*kl) // account for alpha https://stackoverflow.com/a/10271092
//           // sum += data[(hw + col)*4 + ch]*kernel[k] * (ch===ach ? 1 : alphaComp);
//           var a = (Number(data[(hw + col)*4 + ach]) / 255)*Number(kernel[k])
//           sum += Number(data[(hw + col)*4 + ch]*kernel[k]) * (ch===ach ? 1 : a)
//           asum += a
//         }
//         // buff[hw + i] = sum / (ch===ach ? 1 : asum);

//         // TODO: if pixel `(hw + col)*4 + [0-3]` is a solid border (not a ghost border or a non-border) pixel, then don't blur it
//         // run multiple passes of a 3x3 gauss blur

//         buff[hw + i] = sum * (ch===ach ? 1 : (kl-asum)/kl); // STRUGGLE
//         abuff[hw + i] = asum*255;
//       }
//     }

//     // 
//     // a*1 + b*0 + c*0  /  1+0+0
//     // a*1 + b*0 + c*0  *  3
//     // a*1 + b*0 + c*0  *  3/(1+0+0)
//     //
//     // 255*a + 255*b + 255*c   /   (1-a + 1-b + 1-c)
//     // 255*(0.5 + 0.1 + 0.3) / (0.5 + 0.9 + 0.7) 
//     // 255*(0.5 + 0.1 + 0.3) * (3-(0.5 + 0.1 + 0.3)) 
    
//     // Second step process rows
//     for (var j = 0, offset = 0; j < h; j++, offset += w) 
//     {
//       for (var i = 0; i < w; i++)
//       {
//         var sum = 0;
//         for (k = 0; k < kl; k++)
//         {
//           var row = j + (k - mk);
//           row = (row < 0) ? 0 : ((row >= h) ? h - 1 : row);
//           sum += buff[(row*w + i)]*kernel[k];
//         }
//       //   sum *= (ch===ach ? 1 : kl)
//         var off = (j*w + i)*4;
//         if (!boundaries[off/4]) data[off + ch] = boundaries[off/4][ch] // only override the color if it's not a boundary
//         // else                    data[off + ch] = sum 

//         // TODO: if pixel `(hw + col)*4 + [0-3]` is a solid border (not a ghost border or a non-border) pixel, then don't blur it
//         // run multiple passes of a 3x3 gauss blur
//       }
//     }
//   }

/**
* Internal helper method
* @param pixels - the Canvas pixles
* @param kernel - the Gaussian blur kernel
* @param ch - the color channel to apply the blur on
* @param gray - flag to show RGB or Grayscale image
*/
function gauss_internal(pixels, kernel, ch, boundaries, blendDistance){ 
  var data = pixels.data;
  var w = pixels.width;
  var h = pixels.height;
  var buff = new Uint8Array(w*h); 
  var mk = Math.floor(kernel.length / 2);
  var kl = kernel.length;

  // // prefill buff with the values of the image (prevents issues at borders later on)
  // boundaries.forEach(boundaryIndex => {
  //   buff[boundaryIndex] = data[boundaryIndex*4 + ch]
  // })
  // for (var j = 0, hw = 0; j < h; j++, hw += w)  // j is the row, hw is the index of the first pixel in that row
  // {
  //   for (var i = 0; i < w; i++) // i is the column
  //   {
  //     buff[hw + i] = data[(hw + i)*4 + ch]
  //   }
  // }

  // preprocess boundaries for efficiency
  const boundariesByRow = {}
  const boundariesByCol = {}
  boundaries.forEach(boundaryIndex => {
    const row = Math.trunc(boundaryIndex / w)
    const col = Math.trunc(boundaryIndex % w)
    boundariesByRow[row] = boundariesByRow[row] || []
    boundariesByRow[row].push(col)
    boundariesByCol[col] = boundariesByCol[col] || []
    boundariesByCol[col].push(row)
  })


  // TODO: new optimization idea: first, do a distance field floodfill from all the ghost splines (drawing in the non-ghost splines as pure white first)
  // and pass the results in to this function
  // then, in each loop, if the pixel's greyscale value is 0 or > mk+2, skip it (bc it's too far away from any meeting of blendable colors to ever get blended (note: 0 would mean it never got filled bc there was no seed (aka ghost spline point) within the boundary it's located in))
  //
  // also when implementing this, don't forget to get rid of the blurEpicenter idea
  //
  // also, this would limit the pixelSize to... 126?

  var skippedRows = 0
  var skippedCols = 0

  // First step process rows
  for (var j = 0, hw = 0; j < h; j++, hw += w)  // j is the row, hw is the index of the first pixel in that row
  {
    for (var i = 0; i < w; i++) // i is the column
    {
      if (blendDistance && 0xff-blendDistance[(hw + i)*4 + 3] > kl+2) { // for convenience in calculating blendDistance, 255 means "i'm right on top of a blend boundary" and 0 means "I'm 255 pixels away from the nearest blend boundary"
        buff[hw + i] = data[(hw + i)*4 + ch]
        skippedRows++
        continue
      }

      var sum = 0;
      var skippedKernelSum = 0;

      for (var k = 0; k < kl; k++)
      {
        var col = i + (k - mk);
        col = (col < 0) ? 0 : ((col >= w) ? w - 1 : col);

        // if pixel hw+i is on the other side of an edge from pixel hw+col, then skip this pixel and add kernel[k] to skippedKernelSum

        // brainstorming
        // if I group all the boundary pixels by row, I can iterate over those for this row, checking each to see if thier x value is in the range of [i, col]. If so, then skip
        // it feels like there's gotta be some sort of data structure to make that faster. oh well
        const boundaryInterposed = boundariesByRow[j]?.filter(boundaryColumn => Math.min(i, col) <= boundaryColumn && boundaryColumn <= Math.max(i, col)).length > 0
        if (boundaryInterposed) {
          skippedKernelSum += kernel[k];
          continue
        }

        sum += data[(hw + col)*4 + ch]*kernel[k];

      }
      buff[hw + i] = sum / (1 - skippedKernelSum) // renormalize the kernel for the skipped parts
    }
  }
  
  // Second step process columns
  for (var j = 0; j < h; j++) // j is the row
  {
    for (var i = 0; i < w; i++) // i is the column
    {
      var sum = 0;
      var skippedKernelSum = 0;
      var off = (j*w + i)*4;

      if (blendDistance && 0xff-blendDistance[off + 3] > kl+2) { // for convenience in calculating blendDistance, 255 means "i'm right on top of a blend boundary" and 0 means "I'm 255 pixels away from the nearest blend boundary"
        data[off + ch] = buff[j*w + i]
        skippedCols++
        continue
      }

      for (k = 0; k < kl; k++)
      {
        var row = j + (k - mk);
        row = (row < 0) ? 0 : ((row >= h) ? h - 1 : row);
        
        // the skipping done above must be done here as well, only for rows instead of columns
        const boundaryInterposed = boundariesByCol[i]?.filter(boundaryRow => Math.min(j, row) <= boundaryRow && boundaryRow <= Math.max(j, row)).length > 0
        if (boundaryInterposed) {
          skippedKernelSum += kernel[k];
          continue
        }

        sum += buff[(row*w + i)]*kernel[k];
      }

      if (skippedKernelSum < 1) data[off + ch] = sum / (1 - skippedKernelSum) // renormalize the kernel for the skipped parts
    }
  }

  // re-blur the boundaries
  boundaries.forEach(boundaryIndex => {
    const NUM_BLUR_PASSES = 2
    for (var i = 0; i < NUM_BLUR_PASSES; i ++) {
      // I'm being lazy - this should really be blurring into buff and then after, buff should be copied into data
      // also I'm ignoring alpha blending here
      data[boundaryIndex*4 + ch] = (
        data[(boundaryIndex-w)*4 + ch] +
        data[(boundaryIndex+w)*4 + ch] +
        data[(boundaryIndex-1)*4 + ch] +
        data[(boundaryIndex+1)*4 + ch]
      ) / 4
    }
  })

  console.log('TODO: blur the boundaries again')

  console.log({skippedRows, skippedCols})
}
  
  /**
  * Gaussian blur example
  * @param canvas - HTML5 Canvas element
  * @sigma sigma - the standard deviation
  * @param boundaries - a dictionary of pixel indicies (r*w + c) that should not be blurred across
  */
  function gauss(canvas, sigma, boundaries=[], blendDistance=undefined){
    var context = canvas.getContext('2d');
    var pixels = context.getImageData(0, 0, canvas.width,canvas.height);
    var kernel = makeGaussKernel(sigma);
    
    // TODO: replace pixels with a 32bit int array of pixels so all 4 channels can be blurred at once

    // const d32 = new Uint32Array(imageData.data.buffer);  

    // Blur a cahnnel (RGB or Grayscale)
    for (var ch = 0; ch <= 3; ch++){
      gauss_internal(pixels, kernel, ch, boundaries || [], blendDistance);
    }
    // Apply the modified pixels
    context.putImageData(pixels, 0, 0);
  }