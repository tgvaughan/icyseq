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
var coords = false;
var snpView = false;
var baseSeqIdx = 0;
var SNPcount = 0;

var mousex, mousey;

// Colour schemes
var csIdx = 0;
var colourSchemes = {
    "rainbow": {
        "G": [255,0,0,255],
        "T": [0,255,0,255],
        "C": [0,0,255,255],
        "A": [255,255,0,255],
        "U": [255,255,0,255],
        "snp": [0, 255, 0, 255]
    },

    "ice": {
        "G": [0,0,255,255],
        "T": [100,100,255,255],
        "C": [200,200,255,255],
        "A": [255,255,255,255],
        "U": [255,255,255,255],
        "snp": [0, 255, 255, 255]
    },

    "fire": {
        "G": [255,0,0,255],
        "T": [255,100,0,255],
        "C": [255,255,0,255],
        "A": [255,255,255,255],
        "U": [255,255,255,255],
        "snp": [255, 255, 0, 255]
    }
};

// Page initialisation code
$(document).ready(function() {

    $(window).on("resize", function() {
        if (seqData.length !== 0)
            update();
    });

    // Set up drag and drop event listeners
    $("#dropTarget,#output").on("dragover", function(event) {
        event.preventDefault();
        return false;
    });
    $("#dropTarget,#output").on("dragend", function(event) {
        event.preventDefault();
        return false;
    });
    $("#dropTarget,#output").on("drop", function (event) {
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

    // Set up mouse click handler:
    $("#output").click(mouseClickHandler);
    displayDropTarget();

    // Event handlers to ensure coords never displayed when mouse has left window
    $("#output").on("mouseleave", function(event) {
        if (coords)
            $("#cursorCoords").css("display", "none");
    });
    $("#output").on("mouseenter", function(event) {
        if (coords)
            $("#cursorCoords").css("display", "block");
    });

    // Keep mouse coords on hand:
    $("#output").on("mousemove", function(event) {
        var oe = event.originalEvent;
        mousex = oe.layerX;
        mousey = oe.layerY;
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
        $("#help").fadeIn();
    else
        $("#help").fadeOut();
}

function displayNotification(str) {
    $("#notify").stop(true, true);
    $("#notify div").text(str);
    $("#notify").show();
    $("#notify").fadeOut(1000);
}

function getSeqFromY(y, maxY) {
    seqIdx = Math.floor(nSeqs*y/maxY);
    return (seqIdx+1) + " of " + nSeqs + " (" + Object.keys(seqs)[seqIdx] + ")";
}

function getSiteFromX(x, maxX) {
    return (Math.floor(maxSeqLen*x/maxX)+1) + " of " + maxSeqLen;
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

    $("#snp").text(SNPcount);
}

function coordsHandler(event) {
    var oe = event.originalEvent;
    drawCoords(oe.layerX, oe.layerY);
}

function toggleCoords() {
    coords = !coords;

    if (coords) {
        // Ensure coords positioned according to current
        // mouse position
        drawCoords(mousex, mousey);

        $("#cursorCoords").show();
        $("#output").on("mousemove", coordsHandler);
    } else {
        $("#cursorCoords").fadeOut();
        $("#output").off("mousemove", coordsHandler);
    }
}

function cycleColourScheme() {
    csIdx = (csIdx+1) % Object.keys(colourSchemes).length;
    displayNotification(Object.keys(colourSchemes)[csIdx]);

    update();
}

function toggleSNPView() {
    snpView = !snpView;

    update();
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
        countSNPs();
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

// Parse NEXUS-formatted alignment file
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
        data = data.slice(0, match.index) + str + data.slice(match.index+match[0].length, data.length);
    }

    data = data.replace(/\s+/g, " ").trim().split(" ");

    for (i=0; i<data.length; i+=2) {
        if (data[i] in seqs)
            seqs[data[i]] += data[i+1].trim().toUpperCase();
        else
            seqs[data[i]] = data[i+1].trim().toUpperCase();
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

    seqs[thishead] = thisseq.trim().toUpperCase();
}

// Count SNPs
function countSNPs() {

    // Record sequence count and maximum length
    nSeqs = Object.keys(seqs).length;
    maxSeqLen = 0;
    for (var key in seqs) {
        maxSeqLen = Math.max(maxSeqLen, seqs[key].length);
    }

    SNPcount = 0;

    baseSeqIdx = Math.min(baseSeqIdx, nSeqs-1);
    var baseSeq = seqs[Object.keys(seqs)[baseSeqIdx]];
    var colourScheme = colourSchemes[Object.keys(colourSchemes)[csIdx]];

    for (i=0; i<nSeqs; i++) {
        key = Object.keys(seqs)[i];
        seq = seqs[key];

        for (site=0; site<maxSeqLen; site++) {

            if ((seq[site] in colourScheme && baseSeq[site] in colourScheme)
                    && seq[site] !== baseSeq[site])
                SNPcount += 1;
        }
    }
}

// Convert parsed sequences into a nSeqs*maxSeqLen bitmap representing the
// alignment.  This function doesn't actually draw this to the  screen
// - that is handled by update().
function drawAlignmentImage() {

    // Paint alignment to off-screen canvas
    var bufferCanvas = document.getElementById("buffer");
    bufferWidth = Math.min(maxSeqLen, $(window).width());

    bufferCanvas.width = bufferWidth;
    bufferCanvas.height = nSeqs;
    bufferCtx = bufferCanvas.getContext("2d");

    var imageData =  bufferCtx.getImageData(0,0,bufferWidth,nSeqs);
    var data =  imageData.data;

    var colourScheme = colourSchemes[Object.keys(colourSchemes)[csIdx]];

    var i, j, k, seq, offset, site, col;
    if (!snpView) {
        for (i=0; i<nSeqs; i++) {
            key = Object.keys(seqs)[i];
            seq = seqs[key];
            offset = i*bufferWidth*4;

            for (j=0; j<bufferWidth; j++) {
                site = Math.floor(j*maxSeqLen/bufferWidth);

                if (site<seq.length && seq[site] in colourScheme)
                    col = colourScheme[seq[site]];
                else
                    col = [0,0,0,0];

                for (k=0; k<4; k++) {
                    data[offset + 4*j + k] = col[k];
                }
            }
        }
    } else {
        baseSeqIdx = Math.min(baseSeqIdx, nSeqs-1);
        var baseSeq = seqs[Object.keys(seqs)[baseSeqIdx]];

        for (i=0; i<nSeqs; i++) {
            key = Object.keys(seqs)[i];
            seq = seqs[key];
            offset = i*bufferWidth*4;

            for (j=0; j<bufferWidth; j++) {
                var startSite = Math.floor(j*maxSeqLen/bufferWidth);
                var endSite = Math.min(Math.floor((j+1)*maxSeqLen/bufferWidth), maxSeqLen);

                var isSNP = false;
                for (site=startSite; site<endSite; site++) {
                    if ((seq[site] in colourScheme && baseSeq[site] in colourScheme) &&
                            seq[site] !== baseSeq[site])
                        isSNP = true;
                }

                if (isSNP)
                    col = colourScheme.snp;
                else
                    col = [0,0,0,0];

                for (k=0; k<4; k++) {
                    data[offset + 4*j + k] = col[k];
                }
            }
        }
    }
    bufferCtx.putImageData(imageData, 0, 0);
}

// Update canvas
function update() {

    // Draw alignment image off-screen
    drawAlignmentImage();

    // Convert sequences to pixels

    var canvas = $("#output")[0];
    var bufferCanvas = $("#buffer")[0];

    $("#output").height(Math.max(nSeqs, $(window).height()));

    cw = canvas.clientWidth;
    ch = canvas.clientHeight;
    canvas.width = cw;
    canvas.height = ch;

    var ctx = canvas.getContext("2d");
    ctx.scale(canvas.width/bufferWidth, canvas.height/nSeqs);

    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;

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

    if (seqData.length === 0)
        return;

    // Commands which work only when sequences loaded:
    switch (eventChar) {
        case "x":
            toggleCoords();
            return;
        case "c":
            cycleColourScheme();
            return;
        case "s":
            toggleSNPView();
            return;
    }

}

// Mouse click event handler
function mouseClickHandler(event) {

    if (seqData.length === 0)
        return;

    // Set base sequence for SNP view:
    var oe = event.originalEvent;
    baseSeqIdx = Math.floor(nSeqs*oe.clientY/$(window).height());

    update();

    event.preventDefault();
}
