"use strict";
window.jQuery = window.jQuery || {};
var wzXml = {};

/**
 * Determines the maximum value.
 *
 * @return {Number} The maximum value.
 */
Array.prototype.max = function () {
    return Math.max.apply(null, this);
};

/**
 * Determines the minimum value.
 *
 * @return {Number} The minimum value.
 */
Array.prototype.min = function () {
    return Math.min.apply(null, this);
};

HTMLCanvasElement.prototype.getBlob = function (type, q) {
    return new Promise(d => {
        this.toBlob(b => d(b), type, q);
    });
};

function loadFileAsText(blob) {
    return new Promise((a, b) => {
        let fr = new FileReader();
        fr.readAsText(blob, 'UTF-8');
        fr.onload = function () {
            a(this.result);
        };
        fr.onerror = function (e) {
            b(e);
        };
    });
}

async function loadXml(blob) {
    let txt = await loadFileAsText(blob);
    return jQuery.parseXML(txt);
}

class Vector {
    constructor(vectorDom) {
        this._x = vectorDom.getAttribute('x') * 1;
        this._y = vectorDom.getAttribute('y') * 1;
    }

    get x() {
        return this._x;
    }

    get y() {
        return this._y;
    }
}

class CanvasInfo {
    constructor(canvasData, index) {
        this.img = new Image();
        this.img.src = "data:image/png;base64," + canvasData.getAttribute('basedata');
        this.rawDelay = canvasData.querySelector('int[name="delay"]').getAttribute('value') * 1;
        this.origin = new Vector(canvasData.querySelector('vector[name="origin"]'));
        this.index = index * 1;
        this.img.setAttribute('index', this.index);
        imgList.appendChild(this.img);
    }

    done() {
        return new Promise((done, fail) => {
            if (this.img.complete) {
                done();
            } else {
                this.img.onload = function () {
                    done();
                };
            }
        });
    }

    static getInstance(ele, index = undefined) {
        if (index===undefined){
            index = ele.getAttribute('name');
        }
        switch (ele.tagName.toLowerCase()) {
            case 'canvas': {
                let outlink = ele.querySelector(':scope>[name="_outlink"]');
                if (outlink) {
                    let path = outlink.getAttribute('value').split('/');
                    path.shift();

                    let target = wzXml[path[0]];
                    if (!target) {
                        alert(path[0] + ' missing.');
                        throw ele;
                    } else {
                        target = target.querySelector(`[name="${path[0]}"]`);
                        for (let i = 1; i < path.length; i++) {
                            target = target.querySelector(`:scope>[name="${path[i]}"]`);
                        }

                        return CanvasInfo.getInstance(target, index);
                    }
                } else {
                    return new CanvasInfo(ele, index);
                }
            }

            case 'uol': {
                let pathInfo = ele.getAttribute('value').split('/');
                let target = ele.parentNode;
                pathInfo.forEach((token) => {
                    if (token === '..') {
                        target = target.parentNode;
                    } else {
                        target = target.querySelector(`:scope>[name="${token}"]`);
                    }
                });

                return CanvasInfo.getInstance(target, index);
            }
            default:
                throw ele;
        }
    }
}

function combineImage(imgdir) {
    let canvasArray = [];
    imgList.innerHTML = '';
    for (let x of imgdir.children) {
        canvasArray.push(CanvasInfo.getInstance(x));
    }

    canvasArray.sort((a, b) => a.index - b.index);
    return new Promise((_done_lol) => {
        Promise.all(canvasArray.map(x => x.done())).then(a => {
            const DRAW_WIDTH = canvasArray.map(x => x.img.width).max();
            const DRAW_HEIGHT = canvasArray.map(x => x.origin.y).max();
            const PADDING_X = canvasArray.map(x => Math.abs(x.img.width - x.origin.x * 2)).max();
            const PADDING_Y = canvasArray.map(x => Math.abs(x.img.height - x.origin.y)).max();
            const MAX_WIDTH = PADDING_X + DRAW_WIDTH;
            const MAX_HEIGHT = PADDING_Y + DRAW_HEIGHT;
            const R_WIDTH = MAX_WIDTH;
            
            let outputInfo = {};
            let canvas = document.createElement('canvas');
            
            canvas.width = canvasArray.length * (R_WIDTH + 1);
            canvas.height = MAX_HEIGHT + 1;
            let ctx = canvas.getContext('2d');
            ctx.fillStyle = "#F0F";
            canvasArray.forEach((canvasInfo) => {
                const i = canvasInfo.index;
                const X = i * (R_WIDTH + 1), Y = 0;
                //Reset translate
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.translate(X + canvasInfo.origin.x, 0);
                let leftTopPosition = {
                    x: (-canvasInfo.img.width / 2) | 0,
                    y: DRAW_HEIGHT - canvasInfo.origin.y,
                };
                ctx.drawImage(canvasInfo.img, leftTopPosition.x, leftTopPosition.y);
                ctx.fillRect(-canvasInfo.origin.x, 0, 1, MAX_HEIGHT);
            });

            const CX = (R_WIDTH / 2) | 1;
            const CY = DRAW_HEIGHT;

            outputInfo.PerSize = {w: R_WIDTH, h: MAX_HEIGHT};
            outputInfo.Count = canvasArray.length;
            outputInfo.CenterBottom = {x: CX, y: CY};
            outputInfo.Delay = canvasArray.map(x => x.rawDelay);
            let totalTime = 0;
            canvasArray.forEach(function (c) {
                totalTime += c.rawDelay;
            });
            outputInfo.TotalTime = totalTime;
            _done_lol({
                canvasArr: canvasArray,
                canvas: canvas,
                size: {
                    height: MAX_HEIGHT,
                    width: MAX_WIDTH,
                },
                info: outputInfo
            });
            //window.open(canvas.toDataURL());
        });
    });
}

function loadWzXml(files) {
    let p = [];
    for (let f of files) {
        p.push(loadXml(f));
    }
    Promise.all(p).then(arr => {
        arr.forEach(d => {
            let img = d.querySelector('wzimg').getAttribute('name');
            wzXml[img] = d;
        });

        let reqImg = new Set();
        for (let k in wzXml) {
            const img = wzXml[k];
            let outlink = img.querySelectorAll('[name="_outlink"]');
            for (let link of outlink) {
                let v = link.getAttribute('value');
                reqImg.add(v.split('/').filter(x => x.endsWith('.img'))[0]);
            }
        }
        for (let img in wzXml) {
            if (!wzXml.hasOwnProperty(img)) return;
            reqImg.delete(img);
        }
        let miss = [...reqImg];
        if (miss.length > 0) {
            alert('Missing: \n' + miss.join('\n'));
        }

        refWzSel();
    });
}

function refWzSel() {
    let name = jQuery("#xmlName").empty();
    for (let k in wzXml) {
        if (!wzXml.hasOwnProperty(k)) continue;
        const d = wzXml[k];

        let img = d.querySelector('wzimg').getAttribute('name');
        wzXml[img] = d;
        let op = new Option();
        op.textContent = img;
        op.value = img;
        name.append(op);
    }
}

$(function () {
    let onChange = function () {
        if (this.files) {
            loadWzXml(this.files);
        }

        if (this.value) {
            let n = xmlContainer.firstElementChild.cloneNode(true);
            let inp = n.querySelector('input');
            inp.value = '';
            inp.onchange = onChange;
            xmlContainer.appendChild(n);
        }
    };

    $('.xmlFile').change(onChange);
});

function Convert() {
    let e = wzXml[xmlName.value].querySelector(path.value);
    if (!e) {
        alert('Element not found.');
        return;
    }

    combineImage(e)
        .then(async function (data) {
            let imgBlob = await data.canvas.getBlob('image/png');
            let info = data.info;
            let url = URL.createObjectURL(imgBlob);
            jQuery("#outputInfo").val(JSON.stringify(info, undefined, '  '));
            jQuery("#outputImg").prop('src', url);
            jQuery("#dlink").prop('href', url).prop('download', url.split('/').pop() + '.png');
        });
}