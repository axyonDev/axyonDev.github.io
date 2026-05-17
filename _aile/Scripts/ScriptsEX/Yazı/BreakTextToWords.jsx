

//@target Illustrator
// a.gontis @ illustratorscripts.com

var ver = .2

var doc = activeDocument;
var tfs = [];
var a, o, i, j, k, tf, ntf, x, y, words, spaceW, lineH, lines;
for (i = 0; i < doc.selection.length; i++) {
  o = doc.selection[i];
  if (o.typename = "textFrame")
    tfs.push(doc.selection[i])
}
for (i = 0; i < tfs.length; i++) {
  tf = tfs[i]
  lines = tf.lines;
  x = tf.position[0];
  y = tf.position[1];
  //words=tf.words;


  //get space w
  ntf = tf.duplicate();
  ntf.contents = " ";
  spaceW = ntf.width;
  ntf.remove();



  lineH = tf.height / lines.length;

  for (k = 0; k < lines.length; k++) {
    x = 0
    words = lines[k].contents.split(/\s/g);

    for (j = 0; j < words.length; j++) {
      w = words[j];
      ntf = tf.duplicate();
      ntf.contents = w;
      ntf.textRange.characterAttributes.textFont = lines[k].words[j].characterAttributes.textFont
      ntf.position = [tf.position[0] + x, tf.position[1] - lineH * k]


      //ntf.position=[x,-lineH*k ]
      x += ntf.width + spaceW;

      var layer = doc.layers.add(ElementPlacement.PLACEATEND);
      ntf.move(layer, ElementPlacement.PLACEATEND);
      layer.name = w;

    }

  }

  tf.remove();

}




