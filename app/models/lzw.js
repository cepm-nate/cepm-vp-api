// Converted from LZW.php to lzw.js
// How to use:
// const lzw = new LZW();
// const compressed = lzw.compress('TOBEORNOTTOBEORTOBEORNOT');
// const decompressed = lzw.decompress(compressed);
// console.log(compressed, decompressed);

class LZW {
  compress(uncompressed) {
    let i;
    let c;
    let wc;
    let w = "";
    const dictionary = {};
    const result = [];
    let dictSize = 256;
    for (i = 0; i < 256; i += 1) {
      dictionary[String.fromCharCode(i)] = i;
    }
    for (i = 0; i < uncompressed.length; i++) {
      c = uncompressed[i];
      wc = w + c;
      if (dictionary[wc]) {
        w = w + c;
      } else {
        result.push(dictionary[w]);
        dictionary[wc] = dictSize++;
        w = c;
      }
    }
    if (w !== "") {
      result.push(dictionary[w]);
    }
    return result.join(",");
  }

  decompress(compressed) {
    const comp = compressed.split(",");
    let i;
    let w;
    let k;
    let result = "";
    const dictionary = {};
    let dictSize = 256;
    for (i = 0; i < 256; i++) {
      dictionary[i] = String.fromCharCode(i);
    }
    w = String.fromCharCode(comp[0]);
    result = w;
    for (i = 1; i < comp.length; i++) {
      k = parseInt(comp[i]);
      if (dictionary[k]) {
        entry = dictionary[k];
      } else {
        if (k === dictSize) {
          entry = w + w[0];
        } else {
          return null;
        }
      }
      result += entry;
      dictionary[dictSize++] = w + entry[0];
      w = entry;
    }
    return result;
  }
}

module.exports = LZW;