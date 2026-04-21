#target illustrator
try {
  if (app.documents.length == 0) throw 'Dosya yok';
  var angle = parseFloat(prompt("Dönüş açısını gir (örn: 45, -90):", "45"));
  if (isNaN(angle)) throw 'Geçersiz değer';
  var sel = app.documents[0].selection;
  if (!sel || sel.length == 0) throw 'Seçili obje yok';
  for (var i = 0; i < sel.length; i++) {
    sel[i].rotate(angle);
  }
} catch(e) {
  alert(e);
}