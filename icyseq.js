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

// Page initialisation code
$(document).ready(function() {

    $(window).on("resize", update);

    // Set up drag and drop event listeners
    $("#output").on("dragover", function(event) {
        event.preventDefault();
        return false;
    });
    $("#output").on("dragend", function(event) {
        event.preventDefault();
        return false;
    });
    $("#output").on("drop", function (event) {
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


});

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
                seqs[thishead] = thisseq.trim();
            }

            thishead = thisline.substr(1).trim();
            thisseq = "";
            continue;
        }

        thisseq += thisline;
    }

    seqs[thishead] = thisseq;

    update();
}

// Update canvas
function update() {

    var table  = {
        "G": "#FF0000",
        "T": "#00FF00",
        "C": "#0000FF",
        "A": "#FFFF00",
        "-": "#000000",
        "?": "#000000"
    };

    // Convert sequences to pixels

    var nSeqs = Object.keys(seqs).length;
    var maxSeqLen = 0;
    for (var key in seqs) {
        maxSeqLen = Math.max(maxSeqLen, seqs[key].length);
    }

    var canvas = document.getElementById("output");
    var ctx = canvas.getContext("2d");

    cw = canvas.clientWidth;
    ch = canvas.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    ctx.scale(canvas.width/maxSeqLen, canvas.height/nSeqs);

    for (var i=0; i<nSeqs; i++) {
        key = Object.keys(seqs)[i];
        var seq = seqs[key];
        for (var j=0; j<seq.length; j++) {
            for (var k=0; k<4; k++) {
                ctx.fillStyle = table[seq[j]];
                ctx.fillRect(j,i,1,1);
            }
        }
    }
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
            openFileLoadDialog();
            event.preventDefault();
            return;
    }
}
