import * as utils from "./utils";

// TODO split classes into separate files
// tslint:disable:max-classes-per-file

interface IPtrEvtPoint {
  x: number;
  y: number;
}

interface IPointerPointProps {
  isEraser: boolean;
}

class EventPoint {
  public rawPosition: IPtrEvtPoint;
  public properties: IPointerPointProps;

  constructor(evt: PointerEvent) {
    this.rawPosition = { x: evt.x, y: evt.y };
    this.properties = { isEraser: false };
  }
}

export default class InkCanvas {
  public canvas: HTMLCanvasElement;
  public context: CanvasRenderingContext2D;
  public penID: number = -1;
  public gesture: MSGesture;

  // constructor
  constructor(parent: HTMLElement) {
    // setup canvas
    this.canvas = document.createElement("canvas");
    this.canvas.classList.add("drawSurface");
    parent.appendChild(this.canvas);

    // get context
    this.context = this.canvas.getContext("2d");

    let w: number = this.canvas.offsetWidth;
    let h: number = this.canvas.offsetHeight;

    // set the width and height specified through CSS
    this.canvas.setAttribute("width", w.toString());
    this.canvas.setAttribute("height", h.toString());

    let bb = false;
    this.canvas.addEventListener("pointerdown", (evt) => this.handlePointerDown(evt), bb);
    this.canvas.addEventListener("pointermove", (evt) => this.handlePointerMove(evt), bb);
    this.canvas.addEventListener("pointerup", (evt) => this.handlePointerUp(evt), bb);
  }
  // tslint:disable:no-empty
  // Stubs for bunch of functions that are being called in the code below
  // this will make it easier to fill some code in later or just delete them

  public tempEraseMode() {
  }

  public restoreMode() {
  }

  public renderAllStrokes() {
  }

  public anchorSelection() {
  }

  public selectAll() {
  }

  public inkMode() {
  }

  public inkColor() {
  }

  public undo() {
  }

  public redo() {
  }

  // tslint:enable:no-empty

  public anySelected(): boolean {
    return false;
  }

  // We will accept pen down or mouse left down as the start of a stroke.
  // We will accept touch down or mouse right down as the start of a touch.
  public handlePointerDown(evt) {
    this.penID = evt.pointerId;

    if (evt.pointerType === "touch") {
      // ic.gesture.addPointer(evt.pointerId);
    }

    if ((evt.pointerType === "pen") || ((evt.pointerType === "mouse") && (evt.button === 0))) {
      // Anchor and clear any current selection.
      this.anchorSelection();
      let pt = new EventPoint(evt);

      if (pt.properties.isEraser) { // The back side of a pen, which we treat as an eraser
        this.tempEraseMode();
      } else {
        this.restoreMode();
      }

      this.context.beginPath();
      this.context.moveTo(pt.rawPosition.x, pt.rawPosition.y);

      let pressureWidth = evt.pressure * 15;
      this.context.lineWidth = pressureWidth;
      evt.returnValue = false;
    }
  }

  public handlePointerMove(evt) {
    if (evt.pointerId === this.penID) {
      let pt = new EventPoint(evt);
      let w = 8;
      let h = 8;

      if (evt.pointerType === "touch") {
        this.context.strokeStyle = "gray";
        w = evt.width;
        h = evt.height;
        // context.strokeRect(evt.x - w/2 - 1, evt.y - h/2 -1 , w+1, h+1);
        this.context.clearRect(evt.x - w / 4, evt.y - h / 4, w / 2, h / 2);
        evt.returnValue = false;

        return false; // we"re going to clearRect instead
      }

      if (evt.pointerType === "pen") {
        this.context.strokeStyle = "rgba(0, 50, 0,  1)";
        w = w * (0.1 + evt.pressure);
        h = h * (0.1 + evt.pressure);
      } else { // just mouse  
        this.context.strokeStyle = "rgba(250, 0, 0, 0.5)";
      }

      this.context.lineWidth = w;
      this.context.lineTo(evt.clientX, evt.clientY);
      this.context.stroke();
      evt.returnValue = false;

      // let pts = evt.intermediatePoints;
      // for (let i = pts.length - 1; i >= 0 ; i--) {
      // }
    }
    return false;
  }

  public handlePointerUp(evt) {
    if (evt.pointerId === this.penID) {
      this.penID = -1;
      let pt = new EventPoint(evt);
      // ic.context.lineTo(pt.rawPosition.x, pt.rawPosition.y);
      // ic.context.stroke();
      this.context.closePath();
      this.renderAllStrokes();
      evt.returnValue = false;
    }
    return false;
  }

  // We treat the event of the pen leaving the canvas as the same as the pen lifting;
  // it completes the stroke.
  public handlePointerOut(evt) {
    if (evt.pointerId === this.penID) {
      let pt = new EventPoint(evt);
      this.context.lineTo(pt.rawPosition.x, pt.rawPosition.y);
      this.context.stroke();
      this.context.closePath();
      this.penID = -1;
      this.renderAllStrokes();
    }

    return false;
  }

  public handleTap(evt) {
    // Anchor and clear any current selection.
    if (this.anySelected()) {
      this.anchorSelection();
      this.renderAllStrokes();
    }
    return false;
  }

  public clear() {
    if (!this.anySelected()) {
      this.selectAll();
      this.inkMode();
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.renderAllStrokes();
    utils.displayStatus("");
    utils.displayError("");
  }
}
