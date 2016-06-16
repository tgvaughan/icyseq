/**
* @licstart  The following is the entire license notice for the
*  JavaScript code in this page.
*
* Copyright (C) 2016  Tim Vaughan
*
*
* The JavaScript code in this page is free software: you can
* redistribute it and/or modify it under the terms of the GNU
* General Public License (GNU GPL) as published by the Free Software
* Foundation, either version 3 of the License, or (at your option)
* any later version.  The code is distributed WITHOUT ANY WARRANTY;
* without even the implied warranty of MERCHANTABILITY or FITNESS
* FOR A PARTICULAR PURPOSE.  See the GNU GPL for more details.
*
* As additional permission under GNU GPL version 3 section 7, you
* may distribute non-source (e.g., minimized or compacted) forms of
* that code without the copy of the GNU GPL normally required by
* section 4, provided you include this license notice and a URL
* through which recipients can access the Corresponding Source.
*
* @licend  The above is the entire license notice
* for the JavaScript code in this page.
*/

// Global variables
var seqFile;
var seqData = "";
var seqs = {};
var nSeqs;
var maxSeqLen;
var bufferCanvas;
var bufferWidttrueh;
var MAXBUFWIDTH = 32000;
var coords = false;

var mousex, mousey;

// Colour schemes
var table  = {
    "G": [255,0,0,255],
    "T": [0,255,0,255],
    "C": [0,0,255,255],
    "A": [255,255,0,255]
};

// Page initialisation code
$(document).ready(function() {

    $(window).on("resize", update);

    // Set up drag and drop event listeners
    $(window).on("dragover", function(event) {
        event.preventDefault();
        return false;
    });
    $(window).on("dragend", function(event) {
        event.preventDefault();
        return false;
    });
    $(window).on("drop", function (event) {
        event.preventDefault();
        seqFile = event.originalEvent.dataTransfer.files[0];
        loadFile();
    });

    // Listen for file load events:
    $("#fileInput").change(function() {
        seqFile = $("#fileInput").prop("files")[0];
        loadFile();
    });

    // Set up keyboard handler:
    $(window).on("keypress", keyPressHandler);

    displayDropTarget();

    // Event handlers to ensure coords never displayed when mouse has left window
    $(window).on("mouseleave", function(event) {
        if (coords)
            $("#cursorCoords").css("display", "none");
    });
    $(window).on("mouseenter", function(event) {
        if (coords)
            $("#cursorCoords").css("display", "block");
    });

    // Keep mouse coords on hand:
    $(window).on("mousemove", function(event) {
        var oe = event.originalEvent;
        mousex = oe.clientX;
        mousey = oe.clientY;
    });
});

function displayDropTarget() {
    var target = $("#dropTarget");
    target.removeClass();
    target.addClass("start");
}

function hideDropTarget() {
    var target = $("#dropTarget");
    target.removeClass();
}

function toggleHelp() {
    if ($("#help").css("display") == "none")
        $("#help").css("display", "block");
    else
        $("#help").css("display", "none");
}

function getSeqFromY(y, maxY) {
    return Object.keys(seqs)[Math.floor(nSeqs*y/maxY)];
}

function getSiteFromX(x, maxX) {
    return Math.floor(maxSeqLen*x/maxX) + " / " + maxSeqLen;
}

function drawCoords(x, y) {
    var maxX = $("#output").width();
    var maxY = $("#output").height();
    var offset = 10;

    if (x/maxX>0.5)
        $("#cursorCoords").css("left", x - offset - $("#cursorCoords").width());
    else
        $("#cursorCoords").css("left", x + offset);

    if (y/maxY>0.5)
        $("#cursorCoords").css("top", y - offset - $("#cursorCoords").height());
    else
        $("#cursorCoords").css("top", y + offset);

    var seq = getSeqFromY(y, $("#output").height());
    $("#seq").text(seq);

    var site = getSiteFromX(x, $("#output").width());
    $("#site").text(site);
}

function coordsHandler(event) {
    var oe = event.originalEvent;
    drawCoords(oe.clientX, oe.clientY);
}

function toggleCoords() {
    coords = !coords;

    if (coords) {
        // Ensure coords positioned according to current
        // mouse position
        drawCoords(mousex, mousey);

        $("#cursorCoords").css("display", "block");
        $(window).on("mousemove", coordsHandler);
    } else {
        $("#cursorCoords").css("display", "none");
        $(window).off("mousemove", coordsHandler);
    }
}

function openFileLoadDialog() {
    // Clear file input (otherwise can't reload same file)
    $("#fileInput").replaceWith($("#fileInput").clone(true));

    // Trigger click on file input
    $("#fileInput").trigger("click");
}

function loadFile() {
    var reader = new FileReader();
    reader.onload = fileLoaded;
    reader.readAsText(seqFile);

    function fileLoaded(evt) {
        seqData = evt.target.result;
        parseSeqData();
        drawAlignmentImage();
        hideDropTarget();
        update();
    }
}

function parseSeqData() {
    // Clear existing sequences
    seqs = {};

    if (seqData.trim().toLowerCase().startsWith("#nexus"))
        parseNEXUS();

    else if (seqData.trim().startsWith(">"))
        parseFASTA();

    else {
        // Todo: produce error.
        console.log("Error reading file.");
    }
}

function parseNEXUS() {
    var lines = seqData.replace(/\[[^\]]*\]/g,"").replace(/\r/g,'\n').split('\n');

    var indata = false;
    var data;
    for (var i=0; i<lines.length; i++) {
        thisline = lines[i].trim();

        if (!indata) {
            if (thisline.toLowerCase().startsWith("matrix")) {
                thisline = thisline.substr(7);
                data = "";
                indata = true;
            } else
                continue;
            
            if (thisline.indexOf(";") != -1)
                break;
        }

        data += " " + thisline;
        if (thisline.indexOf(";") != -1)
            break;
    }

    data = data.split(";")[0];

    var re1 = /'[^']*'/g;
    var re2 = /"[^"]*"/g;
    while (((match = re1.exec(data)) !== null) || ((match = re2.exec(data)) !== null)) {
        var str = match[0].replace(/\s+/g,"_");
        str = str.substr(1,str.length-2);
        data = data.slice(0, match.index-1) + str + data.slice(match.index+match[0].length, data.length);
    }
    data = data.replace(/\s+/g, " ").trim().split(" ");

    for (i=0; i<data.length; i+=2) {
        if (data[i] in seqs)
            seqs[data[i]] += data[i+1];
        else
            seqs[data[i]] = data[i+1];
    }
}

// Parse fasta-formatted alignment file
function parseFASTA() {
    var lines = seqData.split('\n');

    var first = true;
    var thisseq = "";
    var thishead = "";
    for (var i=0; i<lines.length; i++) {
        var thisline = lines[i].trim();
        if (thisline.startsWith(">")) {
            if (first) {
                first = false;
            } else {
                seqs[thishead] = thisseq.trim().toUpperCase();
            }

            thishead = thisline.substr(1).trim();
            thisseq = "";
            continue;
        }

        thisseq += thisline;
    }

    seqs[thishead] = thisseq;
}

function drawAlignmentImage() {
    // Record sequence count and maximum length
    nSeqs = Object.keys(seqs).length;
    maxSeqLen = 0;
    for (var key in seqs) {
        maxSeqLen = Math.max(maxSeqLen, seqs[key].length);
    }

    // Paint alignment to off-screen canvas
    var bufferCanvas = document.getElementById("buffer");
    bufferWidth = Math.min(maxSeqLen, MAXBUFWIDTH);

    bufferCanvas.width = bufferWidth;
    bufferCanvas.height = nSeqs;
    bufferCtx = bufferCanvas.getContext("2d");

    var imageData =  bufferCtx.getImageData(0,0,bufferWidth,nSeqs);
    var data =  imageData.data;

    for (i=0; i<nSeqs; i++) {
        key = Object.keys(seqs)[i];
        var seq = seqs[key];
        var offset = i*bufferWidth*4;

        for (var j=0; j<bufferWidth; j++) {
            var site = Math.floor(j*maxSeqLen/bufferWidth);

            var col;
            if (seq[site] in table)
                col = table[seq[site]];
            else
                col = [0,0,0,0];

            for (var k=0; k<4; k++) {
                data[offset + 4*j + k] = col[k];
            }
        }
    }
    bufferCtx.putImageData(imageData, 0, 0);
}

// Update canvas
function update() {

    // Convert sequences to pixels

    var canvas = document.getElementById("output");
    var bufferCanvas = document.getElementById("buffer");

    cw = canvas.clientWidth;
    ch = canvas.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    var ctx = canvas.getContext("2d");
    ctx.scale(canvas.width/bufferWidth, canvas.height/nSeqs);
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.drawImage(bufferCanvas, 0, 0);
}

// Keyboard event handler
function keyPressHandler(event) {

    if (event.target !== document.body)
        return;

    if (event.altKey || event.ctrlKey)
        return;

    var eventChar = String.fromCharCode(event.charCode);

    // Commands which are always active:
    switch (eventChar) {
        case "l":
        case "L":
            openFileLoadDialog();
            event.preventDefault();
            return;

        case "?":
            toggleHelp();
            return;
    }

    if (seqData.length == 0)
        return;

    // Commands which work only when sequences loaded:
    switch (eventChar) {
        case "c":
            toggleCoords();
    }

}
