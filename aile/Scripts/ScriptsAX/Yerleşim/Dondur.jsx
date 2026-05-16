#target illustrator
try{ if(app.documents.length==0) throw 'Dosya yok'; var sel=app.documents[0].selection; for(var i=0;i<sel.length;i++) sel[i].rotate(-90); }catch(e){}