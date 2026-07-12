// Generate Handles

// generates handles suitably for each selected pathes.
// Generated handles are extended at right angle to the line
// connecting the anchor and the center of the path.

// JavaScript Script for Adobe Illustrator CS3
// Tested with Adobe Illustrator CS3 13.0.3, Windows XP SP2 (Japanese version).
// This script provided "as is" without warranty of any kind.
// Free to use and distribute.

// Copyright(c) 2009 Hiroyuki Sato
// http://lines-about-to-be-generated.blogspot.com/

// 2009-06-18

const HANDLE_RATIO_BY_LENGTH_OF_SEGMENT = 1 / 6;

main();
function main(){
  var pathes = [];
  getPathItemsInSelection(1, pathes);

  var pi, gb, center, sign;
  var d, i, j, p, v;

  for(var k = 0; k < pathes.length; k++){
    pi = pathes[k];
    p  = pi.pathPoints;

    // finds center
    gb = pi.geometricBounds;
    center = [(gb[0] + gb[2]) / 2, (gb[1] + gb[3]) / 2];
    
    // determines direction from angle
    sign = 1;
    if(p.length > 1 && getRadian2(p[0].anchor, center, p[1].anchor) > 0)
      sign = -1;

    // applies to each anchor point
    if(pi.closed){
      d = dist(p[0].anchor, p[p.length - 1].anchor);
      d *= HANDLE_RATIO_BY_LENGTH_OF_SEGMENT * sign;
    } else {
      d = 0;
    }
    
    for(i = 0; i < p.length; i++){
      v = normalize(p[i].anchor, center);
      v = [v[1], -v[0]]; // rotates 90 degree
      
      p[i].leftDirection  = [-d * v[0] + p[i].anchor[0],
                             -d * v[1] + p[i].anchor[1]];
      
      if(i == p.length - 1){
        if(! pi.closed){
          p[i].rightDirection = p[i].anchor;
          break;
        }
        j = 0;
      } else {
        j = i + 1;
      }

      d = dist(p[i].anchor, p[j].anchor);
      d *= HANDLE_RATIO_BY_LENGTH_OF_SEGMENT * sign;
      p[i].rightDirection = [d * v[0] + p[i].anchor[0],
                             d * v[1] + p[i].anchor[1]];
    }
  }
}
// ----
function normalize(p, o){
  var d = dist(p, o);
  return d == 0 ? [0, 0] : [(p[0] - o[0]) / d, (p[1] - o[1]) / d];
}
// ----
function dist(p1, p2) {
  return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
}
// ----
// finds angle by cross product
function getRadian2(p1, o, p2){
  var v1 = normalize(p1, o);
  var v2 = normalize(p2, o);
  return Math.asin(v1[0] * v2[1] - v1[1] * v2[0]);
}
// ------------------------------------------------
// extract PathItems from the selection which length of PathPoints
// is greater than "n"
function getPathItemsInSelection(n, pathes){
  if(documents.length < 1) return;
  
  var s = activeDocument.selection;
  
  if (!(s instanceof Array) || s.length < 1) return;

  extractPathes(s, n, pathes);
}

// --------------------------------------
// extract PathItems from "s" (Array of PageItems -- ex. selection),
// and put them into an Array "pathes".  If "pp_length_limit" is specified,
// this function extracts PathItems which PathPoints length is greater
// than this number.
function extractPathes(s, pp_length_limit, pathes){
  for(var i = 0; i < s.length; i++){
    if(s[i].typename == "PathItem"
       && !s[i].guides && !s[i].clipping){
      if(pp_length_limit
         && s[i].pathPoints.length <= pp_length_limit){
        continue;
      }
      pathes.push(s[i]);
      
    } else if(s[i].typename == "GroupItem"){
      // search for PathItems in GroupItem, recursively
      extractPathes(s[i].pageItems, pp_length_limit, pathes);
      
    } else if(s[i].typename == "CompoundPathItem"){
      // searches for pathitems in CompoundPathItem, recursively
      // ( ### Grouped PathItems in CompoundPathItem are ignored ### )
      extractPathes(s[i].pathItems, pp_length_limit , pathes);
    }
  }
}

