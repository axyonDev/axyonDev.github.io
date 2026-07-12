var win = new Window("dialog", "Dolgu Rengi");
win.add("statictext", undefined, "CMYK (0-100):");
var g2 = win.add("group");
var cInp = g2.add("edittext", undefined, "0"); cInp.characters = 3;
var mInp = g2.add("edittext", undefined, "100"); mInp.characters = 3; // Varsayılan Magenta
var yInp = g2.add("edittext", undefined, "100"); yInp.characters = 3;
var kInp = g2.add("edittext", undefined, "0"); kInp.characters = 3;

win.add("button", undefined, "Boyala", {name: "ok"});

if (win.show() == 1) {
    var newColor = new CMYKColor();
    newColor.cyan = parseFloat(cInp.text);
    newColor.magenta = parseFloat(mInp.text);
    newColor.yellow = parseFloat(yInp.text);
    newColor.black = parseFloat(kInp.text);
    
    var sel = app.activeDocument.selection;
    for(var i=0; i<sel.length; i++){
        sel[i].filled = true;
        sel[i].fillColor = newColor;
    }
}