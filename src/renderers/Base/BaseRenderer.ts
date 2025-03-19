export class BaseRenderer {
    canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    init() {}

    destroy() {}

    update() {}

    draw() {}
}
