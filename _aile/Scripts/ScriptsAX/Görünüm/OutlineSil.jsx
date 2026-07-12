var sel = app.activeDocument.selection;
for (var i=0; i<sel.length; i++) {
    sel[i].stroked = false;
}