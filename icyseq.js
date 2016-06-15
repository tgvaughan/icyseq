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
var seqData;
var seqs = {};
var nSeqs;
var maxSeqLen;
var bufferCanvas;
var bufferWidth;
var MAXBUFWIDTH = 32000;

// Colour scheme
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
    }
}

// Parse fasta-formatted alignment file
function parseSeqData() {

    // Clear existing sequences
    seqs = {};

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

    hideDropTarget();

    update();
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
    switch (eventChar) {
        case "l":
        case "L":
            openFileLoadDialog();
            event.preventDefault();
            return;
    }
}
