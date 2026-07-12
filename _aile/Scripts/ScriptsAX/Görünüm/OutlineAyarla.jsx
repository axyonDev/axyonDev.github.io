var win = new Window("dialog", "Çizgi Ayarı");
win.orientation = "column";

var g1 = win.add("group");
g1.add("statictext", undefined, "Kalınlık (pt):");
var inpPt = g1.add("edittext", undefined, "1");
inpPt.characters = 4;

win.add("statictext", undefined, "CMYK Değerleri:");
var g2 = win.add("group");
var cInp = g2.add("edittext", undefined, "0"); cInp.characters = 3;
var mInp = g2.add("edittext", undefined, "0"); mInp.characters = 3;
var yInp = g2.add("edittext", undefined, "0"); yInp.characters = 3;
var kInp = g2.add("edittext", undefined, "100"); kInp.characters = 3;

win.add("button", undefined, "Uygula", {name: "ok"});

if (win.show() == 1) {
    var newColor = new CMYKColor();
    newColor.cyan = parseFloat(cInp.text);
    newColor.magenta = parseFloat(mInp.text);
    newColor.yellow = parseFloat(yInp.text);
    newColor.black = parseFloat(kInp.text);
    
    var sel = app.activeDocument.selection;
    for(var i=0; i<sel.length; i++){
        sel[i].stroked = true;
        sel[i].strokeWidth = parseFloat(inpPt.text);
        sel[i].strokeColor = newColor;
    }
}