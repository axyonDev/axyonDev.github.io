#target illustrator
#targetengine "AhmetHassasRenk"
var cr_sourceData = { color: null, type: 'None' }; var cr_destData = { color: null, type: 'None' };
main();
function main() {
    var winPalette = new Window("palette", "Hassas Renk Değiştirici", undefined, {resizeable: true, closeButton: true});
    winPalette.orientation = "column"; winPalette.alignChildren = ["fill", "top"]; winPalette.spacing = 5; winPalette.margins = 10;
    createCRRow(winPalette, "BUL:", true);
    var sep2 = winPalette.add("panel"); sep2.alignment = "fill"; sep2.preferredSize.height = 1;
    createCRRow(winPalette, "YAP:", false);
    var cr_grpOpts = winPalette.add("group"); cr_grpOpts.orientation = "row"; cr_grpOpts.alignChildren = ["left", "center"]; cr_grpOpts.spacing = 15;
    var cr_grpTarg = cr_grpOpts.add("panel", undefined, "Etkilenecek Alanlar"); cr_grpTarg.orientation = "row";
    var cr_chkFill = cr_grpTarg.add("checkbox", undefined, "Dolgu"); var cr_chkStroke = cr_grpTarg.add("checkbox", undefined, "Kontur"); cr_chkFill.value = true; cr_chkStroke.value = true;
    var cr_grpScope = cr_grpOpts.add("panel", undefined, "Kapsam"); cr_grpScope.orientation = "row";
    var cr_radioSel = cr_grpScope.add("radiobutton", undefined, "Seçili Objeler"); var cr_radioDoc = cr_grpScope.add("radiobutton", undefined, "Tüm Belge"); cr_radioDoc.value = true;
    var cr_grpBtns = winPalette.add("group"); cr_grpBtns.orientation = "row"; cr_grpBtns.alignChildren = ["fill", "center"]; cr_grpBtns.spacing = 5;
    var cr_btnUndo = cr_grpBtns.add("button", undefined, "Geri Al"); cr_btnUndo.preferredSize.width = 80;
    var cr_btnOk = cr_grpBtns.add("button", undefined, "RENKLERİ DEĞİŞTİR"); cr_btnOk.preferredSize.width = 180;
    function createCRRow(parent, labelText, isSource) {
        var row = parent.add("group"); row.orientation = "row"; row.alignChildren = ["left", "center"]; row.spacing = 3;
        var lbl = row.add("statictext", undefined, labelText); lbl.preferredSize.width = 30;
        var preview = row.add("custombutton"); preview.preferredSize = [25, 25]; preview.myRGB = [0.9, 0.9, 0.9];
        preview.onDraw = function() { var g = this.graphics; var brush = g.newBrush(g.BrushType.SOLID_COLOR, this.myRGB); g.newPath(); g.rectPath(0, 0, 25, 25); g.fillPath(brush); var pen = g.newPen(g.PenType.SOLID_COLOR, [0.4, 0.4, 0.4], 1); g.strokePath(pen); }
        var btnPickFill = row.add("button", undefined, "Dolgu"); btnPickFill.preferredSize = [45, 25];
        var btnPickStroke = row.add("button", undefined, "Kontur"); btnPickStroke.preferredSize = [45, 25];
        var btnMan = row.add("button", undefined, "M"); btnMan.preferredSize = [25, 25];
        var infoText = row.add("statictext", undefined, "Renk seçilmedi..."); infoText.preferredSize.width = 110; infoText.graphics.font = ScriptUI.newFont("Arial", "Regular", 10);
        btnPickFill.onClick = function() { runPickColor(isSource, preview, infoText, 'fill'); };
        btnPickStroke.onClick = function() { runPickColor(isSource, preview, infoText, 'stroke'); };
        btnMan.onClick = function() { showManualColorDialog(isSource, preview, infoText); };
    }
    function runPickColor(isSource, previewPnl, infoLbl, mode) {
        var bt = new BridgeTalk(); bt.target = "illustrator";
        bt.body = "var res = (function() { if (app.documents.length === 0) return 'NODOC'; if (app.activeDocument.selection.length === 0) return 'NOSEL'; " + findColorData.toString() + ";" + colorToJSON.toString() + "; var item = app.activeDocument.selection[0]; var data = findColorData(item, '" + mode + "'); if (!data) return 'NOCOLOR'; return data; })(); res;";
        bt.onResult = function(resObj) {
            var result = resObj.body; if (result === "NODOC") { alert("Döküman yok!"); return; } if (result === "NOSEL") { alert("Bir nesne seçmelisin!"); return; } if (result === "NOCOLOR") { alert("Seçilen objede " + (mode=='fill'?'DOLGU':'KONTUR') + " rengi bulunamadı."); return; }
            var data = eval("(" + result + ")"); if (isSource) cr_sourceData = data; else cr_destData = data; updateDisplay(previewPnl, infoLbl, data);
        }; bt.send();
    }
    function updateDisplay(previewPnl, infoLbl, data) {
        if (!data || !data.color) return; var c = data.color; var displayRGB = [0.5, 0.5, 0.5]; var textStr = "";
        if (c.type === "CMYK") { var k = c.k / 100; var r = (1 - (c.c / 100)) * (1 - k); var g = (1 - (c.m / 100)) * (1 - k); var b = (1 - (c.y / 100)) * (1 - k); displayRGB = [r, g, b]; textStr = "C:" + Math.round(c.c) + " M:" + Math.round(c.m) + " Y:" + Math.round(c.y) + " K:" + Math.round(c.k); } 
        else if (c.type === "RGB") { displayRGB = [c.r/255, c.g/255, c.b/255]; textStr = "R:" + Math.round(c.r) + " G:" + Math.round(c.g) + " B:" + Math.round(c.b); } 
        else if (c.type === "Gray") { var g = 1 - c.g/100; displayRGB = [g, g, g]; textStr = "Gray: %" + Math.round(c.g); } 
        else if (c.type === "Spot") { displayRGB = [0.8, 0.9, 0.6]; textStr = c.name; } else if (c.type === "None") { textStr = "Renk Yok"; }
        previewPnl.myRGB = displayRGB; previewPnl.notify("onDraw"); infoLbl.text = textStr; winPalette.layout.layout(true);
    }
    function showManualColorDialog(isSource, previewPnl, infoLbl) {
        var dlg = new Window("dialog", "Manuel Renk"); dlg.alignChildren = "left"; var et = dlg.add("edittext", undefined, "0,0,0,100"); et.preferredSize.width = 200; dlg.add("statictext", undefined, "CMYK (0,100,0,0) veya RGB (255,0,0)"); dlg.add("button", undefined, "Tamam", {name:"ok"});
        if (dlg.show() == 1) { var parts = et.text.split(","); if(parts.length === 4) { var mData = { color: { type: "CMYK", c:Number(parts[0]), m:Number(parts[1]), y:Number(parts[2]), k:Number(parts[3]) } }; if(isSource) cr_sourceData = mData; else cr_destData = mData; updateDisplay(previewPnl, infoLbl, mData); } else if (parts.length === 3) { var mData = { color: { type: "RGB", r:Number(parts[0]), g:Number(parts[1]), b:Number(parts[2]) } }; if(isSource) cr_sourceData = mData; else cr_destData = mData; updateDisplay(previewPnl, infoLbl, mData); } else { alert("Hatalı format."); } }
    }
    cr_btnOk.onClick = function() {
        if (!cr_sourceData.color || !cr_destData.color) { alert("Lütfen hem BUL hem YAP renklerini seçin!"); return; } if(!cr_chkFill.value && !cr_chkStroke.value) { alert("En az bir hedef (Dolgu veya Kontur) seçmelisin!"); return; }
        var bt = new BridgeTalk(); bt.target = "illustrator"; var sStr = objectToSource(cr_sourceData.color); var dStr = objectToSource(cr_destData.color);
        bt.body = "var res = (function() { var sColor = " + jsonToColorFunc + "(" + sStr + "); var dColor = " + jsonToColorFunc + "(" + dStr + "); var items = " + cr_radioSel.value + " ? app.activeDocument.selection : app.activeDocument.pageItems; " + processItems.toString() + "; " + isSameColor.toString() + "; return processItems(items, sColor, dColor, " + cr_chkFill.value + ", " + cr_chkStroke.value + "); })(); res;";
        bt.onResult = function(res) { alert("İşlem Tamam: " + res.body + " nesne değişti."); }; bt.send();
    };
    cr_btnUndo.onClick = function() { var bt = new BridgeTalk(); bt.target = "illustrator"; bt.body = "app.undo(); 'OK';"; bt.send(); };
    function objectToSource(o) { var s = "{"; for (var k in o) s += "'" + k + "': '" + o[k] + "',"; s += "}"; return s; }
    winPalette.center(); winPalette.show();
}
function findColorData(item, mode) { function getDeepItem(itm) { if (itm.typename === "PathItem") { if (mode === 'fill' && itm.filled) return {obj:itm, type:'fill'}; if (mode === 'stroke' && itm.stroked) return {obj:itm, type:'stroke'}; if (mode === 'auto') { if (itm.filled) return {obj:itm, type:'fill'}; if (itm.stroked) return {obj:itm, type:'stroke'}; } return null; } if (itm.typename === "GroupItem" || itm.typename === "CompoundPathItem") { var subItems = (itm.typename==="GroupItem") ? itm.pageItems : itm.pathItems; for (var i=0; i<subItems.length; i++) { var found = getDeepItem(subItems[i]); if (found) return found; } } return null; } var targetData = getDeepItem(item); if (!targetData) return null; var col = (targetData.type === 'fill') ? targetData.obj.fillColor : targetData.obj.strokeColor; var dataStr = colorToJSON(col); return "{ color:" + dataStr + " }"; }
function colorToJSON(col) { var o = {}; if (col.typename === "CMYKColor") { o.type="CMYK"; o.c=col.cyan; o.m=col.magenta; o.y=col.yellow; o.k=col.black; } else if (col.typename === "RGBColor") { o.type="RGB"; o.r=col.red; o.g=col.green; o.b=col.blue; } else if (col.typename === "SpotColor") { o.type="Spot"; o.name=col.spot.name; } else if (col.typename === "GrayColor") { o.type="Gray"; o.g=col.gray; } else { o.type="None"; } var s = "{"; for (var k in o) s += "'" + k + "': '" + o[k] + "',"; s += "}"; return s; }
var jsonToColorFunc = "function(data) { var c = null; if (data.type === 'CMYK') { c = new CMYKColor(); c.cyan=Number(data.c); c.magenta=Number(data.m); c.yellow=Number(data.y); c.black=Number(data.k); } else if (data.type === 'RGB') { c = new RGBColor(); c.red=Number(data.r); c.green=Number(data.g); c.blue=Number(data.b); } else if (data.type === 'Gray') { c = new GrayColor(); c.gray=Number(data.g); } else if (data.type === 'Spot') { try { c = app.activeDocument.swatches.getByName(data.name).color; } catch(e){} } return c; }";
function processItems(items, sColor, dColor, doFill, doStroke) { var count = 0; for (var i = 0; i < items.length; i++) { var item = items[i]; if (item.typename === "GroupItem") { count += processItems(item.pageItems, sColor, dColor, doFill, doStroke); } else if (item.typename === "CompoundPathItem") { count += processItems(item.pathItems, sColor, dColor, doFill, doStroke); } else if (item.typename === "PathItem") { try { if (doFill && item.filled && isSameColor(item.fillColor, sColor)) { item.fillColor = dColor; count++; } if (doStroke && item.stroked && isSameColor(item.strokeColor, sColor)) { item.strokeColor = dColor; count++; } } catch(e) {} } } return count; }
function isSameColor(c1, c2) { if (!c1 || !c2 || c1.typename !== c2.typename) return false; var tol = 0.5; if (c1.typename === "CMYKColor") return Math.abs(c1.cyan-c2.cyan)<tol && Math.abs(c1.magenta-c2.magenta)<tol && Math.abs(c1.yellow-c2.yellow)<tol && Math.abs(c1.black-c2.black)<tol; if (c1.typename === "RGBColor") return Math.abs(c1.red-c2.red)<tol && Math.abs(c1.green-c2.green)<tol && Math.abs(c1.blue-c2.blue)<tol; if (c1.typename === "GrayColor") return Math.abs(c1.gray-c2.gray)<tol; if (c1.typename === "SpotColor") return c1.spot.name === c2.spot.name; return false; }