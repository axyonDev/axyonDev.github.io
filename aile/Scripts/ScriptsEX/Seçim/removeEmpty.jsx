//@target illustrator
//@target engine main
/// author: www.illustratorscripts.com

function main() {
  var toRem=[]
  var doc=app.activeDocument;
  var pItems=doc.pathItems
  for (var i=0;i<pItems.length;i++){
  
    var o=pItems[i];
    if(("CompoundPathItem"==o.parent.constructor.name)||
        o.stroked||
        o.filled||
        o.clipping){          
        }else{
          toRem.push(o)
        }
  }
  var cpi=doc.compoundPathItems;  
  for (var i=0;i<cpi.length;i++){
    var pi=cpi[i].pathItems;
    //check all path items in cp
    var allInvisible=true
    for (var j=0;j<pi.length;j++){
      var p=pi[j];
      if(p.stroked || p.filled || p.clipping){
        allInvisible=false;
        break
      }  
    }
    if(allInvisible)
      toRem.push(cpi[i])
  }
  
  for (var i = toRem.length - 1; i >= 0; i--) {
    toRem[i].remove();
  }

};


app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

main();
