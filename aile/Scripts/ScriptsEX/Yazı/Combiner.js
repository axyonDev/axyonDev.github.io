// Combiner
// Version 0.2
// (c) vd [vd(kot)online.com.ua]

// This software is distributed under the  
// terms of GNU General Public License.
// http://www.gnu.org/licenses/gpl.html


function topOrder(a,b) {
	if(a.top == b.top) 
		return a.left - b.left;
	else 
		return b.top - a.top;
}

if(documents.length > 0) {
	doc = activeDocument;
	mySelection = activeDocument.selection;

	if (mySelection instanceof Array) {
		mySelection.sort(topOrder);
		newFrame = mySelection[0].parent.textFrames.add();
		newFrame.top = mySelection[0].top;
		newFrame.left = mySelection[0].left;

		while(mySelection.length)
		if (mySelection[0].typename == "TextFrame") {
			frame = mySelection.shift();
			frame.textRange.duplicate(newFrame);
			frame.remove();
		}
		else {
			mySelection.shift();
		}
	}
}