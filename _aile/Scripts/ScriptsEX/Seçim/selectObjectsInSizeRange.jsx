//@target illustrator
/// author: www.illustratorscripts.com

const MAX_VALUE = 1000;
const ERRATUM = .0001;
//saves small settings droplet in my docs folder !!!
const settingsFileName = "SelectObjectsInSizeRange.json"


function createPanel(startVal) {

	// DIALOG
	// ======
	var dialog = new Window("dialog");
	dialog.text = "Select objects in size range";
	dialog.orientation = "column";
	dialog.alignChildren = ["center", "bottom"];
	dialog.spacing = 10;
	dialog.margins = 16;

	// PANEL1
	// ======
	var panel1 = dialog.add("panel", undefined, undefined, {
		name: "panel1"
	});
	panel1.text = "Width ⧓";
	panel1.orientation = "row";
	panel1.alignChildren = ["left", "top"];
	panel1.spacing = 10;
	panel1.margins = 10;

	// PANEL2
	// ======
	var panel2 = panel1.add("panel", undefined, undefined, {
		name: "panel2"
	});
	panel2.text = "Min";
	panel2.orientation = "column";
	panel2.alignChildren = ["left", "top"];
	panel2.spacing = 10;
	panel2.margins = 10;

	var edittext1 = panel2.add('edittext {properties: {name: "edittext1"}}');
	edittext1.text = "" + MAX_VALUE;
	edittext1.preferredSize = [100, 30]

	var slider1 = panel2.add("slider", undefined, undefined, undefined, undefined, {
		name: "slider1"
	});
	slider1.minvalue = 0;
	slider1.maxvalue = MAX_VALUE;
	slider1.value = 50;

	// PANEL3
	// ======
	var panel3 = panel1.add("panel", undefined, undefined, {
		name: "panel3"
	});
	panel3.text = "Max";
	panel3.orientation = "column";
	panel3.alignChildren = ["left", "top"];
	panel3.spacing = 10;
	panel3.margins = 10;

	var edittext2 = panel3.add('edittext {properties: {name: "edittext2"}}');
	edittext2.text = "" + MAX_VALUE;
	edittext2.preferredSize = [100, 30]

	var slider2 = panel3.add("slider", undefined, undefined, undefined, undefined, {
		name: "slider2"
	});
	slider2.minvalue = 0;
	slider2.maxvalue = MAX_VALUE;
	slider2.value = 50;

	// PANEL4
	// ======
	var panel4 = dialog.add("panel", undefined, undefined, {
		name: "panel4"
	});
	panel4.text = "Height ⧫";
	panel4.orientation = "row";
	panel4.alignChildren = ["left", "top"];
	panel4.spacing = 10;
	panel4.margins = 10;

	// PANEL5
	// ======
	var panel5 = panel4.add("panel", undefined, undefined, {
		name: "panel5"
	});
	panel5.text = "Min";
	panel5.orientation = "column";
	panel5.alignChildren = ["left", "top"];
	panel5.spacing = 10;
	panel5.margins = 10;

	var edittext3 = panel5.add('edittext {properties: {name: "edittext3"}}');
	edittext3.text = "" + MAX_VALUE;
	edittext3.preferredSize = [100, 30]

	var slider3 = panel5.add("slider", undefined, undefined, undefined, undefined, {
		name: "slider3"
	});
	slider3.minvalue = 0;
	slider3.maxvalue = MAX_VALUE;
	slider3.value = 50;

	// PANEL6
	// ======
	var panel6 = panel4.add("panel", undefined, undefined, {
		name: "panel6"
	});
	panel6.text = "Max";
	panel6.orientation = "column";
	panel6.alignChildren = ["left", "top"];
	panel6.spacing = 10;
	panel6.margins = 10;

	var edittext4 = panel6.add('edittext {properties: {name: "edittext4"}}');
	edittext4.text = "" + MAX_VALUE;
	edittext4.preferredSize = [100, 30]

	var slider4 = panel6.add("slider", undefined, undefined, undefined, undefined, {
		name: "slider4"
	});
	slider4.minvalue = 0;
	slider4.maxvalue = MAX_VALUE;
	slider4.value = 50;

	var checkbox1 = dialog.add("checkbox", undefined, undefined, {
		name: "checkbox1"
	});
	checkbox1.text = "Save ranges";
	checkbox1.value = startVal[4];
	checkbox1.alignment = ["left", "bottom"];

	// GROUP1
	// ======
	var group1 = dialog.add("group", undefined, {
		name: "group1"
	});
	group1.orientation = "row";
	group1.alignChildren = ["left", "center"];
	group1.spacing = 10;
	group1.margins = 0;

	var button1 = group1.add("button", undefined, undefined, {
		name: "button1"
	});
	button1.helpTip = "Don't select anything";
	button1.text = "Cancel";
	button1.justify = "left";

	var button2 = group1.add("button", undefined, undefined, {
		name: "button2"
	});
	button2.helpTip = "Select objects in size range";
	button2.text = "OK";
	button2.justify = "left";

	SliderText(slider1, edittext1, startVal[0]);
	SliderText(slider2, edittext2, startVal[1]);
	SliderText(slider3, edittext3, startVal[2]);
	SliderText(slider4, edittext4, startVal[3]);


	return dialog;

}

function save(data) {
  trace("saving",data)
//	try {
    var settingsFileURL = Folder.myDocuments + "/" + settingsFileName;
		var file = File(settingsFileURL);
		file.open("w");
		file.write(JSON.stringify(data));
		file.close();
	// } catch (e) {
	// 	$.writeln("err writing")
	// }
}

function load() {
  var data
	try {
		var settingsFileURL = Folder.myDocuments + "/" + settingsFileName;

		var file = File(settingsFileURL);

		if (file.exists) {
			file.open('r');
      var r=file.read();
      trace("file read",r )
			data = JSON.parse(r);
			file.close();
		}
	} catch (e) {
		$.writeln("err writing")
	}
  trace("reading parsed", data)
	return data;
}

function iterateGroupsAndSubLayers(o, pathAndCompoundCheck, groupCheck, this_) {
	//layers
	if (o.layers) {
		for (var i = 0; i < o.layers.length; i++) {
			if (o.layers[i].visible) {

				iterateGroupsAndSubLayers(o.layers[i], pathAndCompoundCheck, groupCheck, this_)
			}
		}
	}
	//groups
	var items = o.pageItems;
	if (!items) return
	for (var i = 0; i < items.length; i++) {
		if (items[i].typename == "GroupItem") {
			if (!items[i].hidden) {
				//trace(" group>");
				if (groupCheck) {

					var check = groupCheck(items[i], this_)
					if (!check)
						iterateGroupsAndSubLayers(items[i], pathAndCompoundCheck, groupCheck, this_)
				}
			}
		} else if (items[i].typename == "PathItem" || items[i].typename == "CompoundPathItem") {
			if (!items[i].hidden) {
				//trace(items[i]);
				pathAndCompoundCheck && pathAndCompoundCheck(items[i], this_)
			}
		}
	}
}

function SliderText(slider, txt, current) {
	// this.slider=slider;
	// this.txt=txt;
	//
	// this.current=current;
	current = parseFloat(current);
	slider.value = current;
	txt.text = "" + current;


	slider.onChange = slider.onChanging = function() {
		//! this is slider's this
		txt.text = Math.round(this.value);
	}

	txt.onChange = txt.onChanging = function() {
		//! this is slider's this
		slider.value = this.text;
	}
}


function main() {
  
  
	settings = load();
	settings = settings || [0, 1000, 0, 1000, false];
  
  //if something is selected, we use measurements
  if(doc.selection.length==1){
    var o=doc.selection[0];
    //varnele islaikom is senu
    settings= [o.width,o.width,o.height,o.height,settings[4]]
  }  

	var dialog = createPanel(settings);
	var r = dialog.show()
	//cancel
	if (2 == r) return



	var wMin = parseFloat(dialog.panel1.panel2.edittext1.text)
	var wMax = parseFloat(dialog.panel1.panel3.edittext2.text)
	var hMin = parseFloat(dialog.panel4.panel5.edittext3.text)
	var hMax = parseFloat(dialog.panel4.panel6.edittext4.text)

	if (dialog.checkbox1.value)
		save([wMin, wMax, hMin, hMax,dialog.checkbox1.value])
  else{
    //save only checbox
    settings[4]=dialog.checkbox1.value
    save(settings)
  }
	var selected = [];

	function pathAndCompoundCheck(obj) {

		if (obj)
			if (obj.width >= wMin||closeEnough(obj.width,wMin))
				if (obj.width <= wMax||closeEnough(obj.width,wMax))
					if (obj.height >= hMin||closeEnough(obj.height,hMin))
						if (obj.height <= hMax||closeEnough(obj.height,hMax)) {
							selected.push(obj)
						}
	}
	iterateGroupsAndSubLayers(doc, pathAndCompoundCheck)

	//  $.writeln(selected.length)
	doc.selection = selected

}

function closeEnough(a,b){
  return Math.abs(a-b)<ERRATUM;
}



function getLayer(name) {
	var layer;

	try {
		layer = doc.layers.getByName(name)
	} catch (err) {
		layer = doc.layers.add()
		layer.name = name
	}
	layer.locked = false;
	layer.visible = true;
	return layer;

}

function trace() {
return
  var s = "";
  for (var i = 0; i < arguments.length; i++) {
    s += arguments[i] + " "
  }
  $.writeln(s);
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////JSON parser minified////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


"object"!=typeof JSON&&(JSON={}),function(){"use strict";function f(t){return 10>t?"0"+t:t}function quote(t){
  return escapable.lastIndex=0,escapable.test(t)?'"'+t.replace(escapable,function(t){var e=meta[t];
    return"string"==typeof e?e:"\\u"+("0000"+t.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+t+'"'}
  function str(t,e){var n,r,o,f,u,i=gap,p=e[t];switch(p&&"object"==typeof p&&"function"==typeof p.toJSON&&(p=p.toJSON(t)),
    "function"==typeof rep&&(p=rep.call(e,t,p)),typeof p){case"string":return quote(p);case"number":return isFinite(p)?String(p):"null";
  case"boolean":case"null":return String(p);case"object":if(!p)return"null";if(gap+=indent,u=[],"[object Array]"===Object.prototype.toString.apply(p)){
    for(f=p.length,n=0;f>n;n+=1)u[n]=str(n,p)||"null";return o=0===u.length?"[]":gap?"[\n"+gap+u.join(",\n"+gap)+"\n"+i+"]":"["+u.join(",")+"]",gap=i,o}
      if(rep&&"object"==typeof rep)for(f=rep.length,n=0;f>n;n+=1)"string"==typeof rep[n]&&(r=rep[n],o=str(r,p),o&&u.push(quote(r)+(gap?": ":":")+o));
    else for(r in p)Object.prototype.hasOwnProperty.call(p,r)&&(o=str(r,p),o&&u.push(quote(r)+(gap?": ":":")+o));return o=0===u.length?"{}":gap?"{\n"+gap+
    u.join(",\n"+gap)+"\n"+i+"}":"{"+u.join(",")+"}",gap=i,o}}"function"!=typeof Date.prototype.toJSON&&(Date.prototype.toJSON=function(){
      return isFinite(this.valueOf())?this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+
      f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z":null},String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(){
        return this.valueOf()});var cx,escapable,gap,indent,meta,rep;"function"!=typeof JSON.stringify&&
    (escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      meta={"\b":"\\b","  ":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},JSON.stringify=function(t,e,n){var r;
        if(gap="",indent="","number"==typeof n)for(r=0;n>r;r+=1)indent+=" ";else"string"==typeof n&&(indent=n);if(rep=e,
          e&&"function"!=typeof e&&("object"!=typeof e||"number"!=typeof e.length))throw new Error("JSON.stringify");return str("",{"":t})}),
    "function"!=typeof JSON.parse&&(cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      JSON.parse=function(text,reviver){function walk(t,e){var n,r,o=t[e];if(o&&"object"==typeof o)for(n in o)Object.prototype.hasOwnProperty.call(o,n)&&
      (r=walk(o,n),void 0!==r?o[n]=r:delete o[n]);return reviver.call(t,e,o)}var j;if(text=String(text),cx.lastIndex=0,cx.test(text)&&
        (text=text.replace(cx,function(t){return"\\u"+("0000"+t.charCodeAt(0).toString(16)).slice(-4)})),
        /^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@")
          .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]")
          .replace(/(?:^|:|,)(?:\s*\[)+/g,"")))return j=eval("("+text+")"),"function"==typeof reviver?walk({"":j},""):j;
      throw new SyntaxError("JSON.parse")})}();


      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
      ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////





var doc = app.activeDocument;
var styles = app.activeDocument.graphicStyles
var tempLayer = doc.layers.add()
main();
tempLayer.remove();
//$.writeln($.hiresTimer)
