import { BaseRenderer } from "../Base/BaseRenderer";

export class WebGPUInitRenderer extends BaseRenderer {
    device!: GPUDevice;
    context!: GPUCanvasContext;
    clearColor: [number, number, number, number] = [0.93, 0.99, 0.13, 1];

    constructor(canvas: HTMLCanvasElement) {
        super(canvas);
    }

    async init() {
        if (!navigator.gpu) {
            throw new Error("WebGPU not supported");
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error("No adapter found");
        }

        this.device = await adapter.requestDevice();

        const context = this.canvas.getContext("webgpu");

        if (!context) {
            throw new Error("WebGPU context not available");
        }

        this.context = context;

        const format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: format,
            alphaMode: "premultiplied",
        });
    }

    destroy() {
        this.device?.destroy();
    }

    update() {}

    draw() {
        const commandEncoder = this.device.createCommandEncoder();
        const textureView = this.context.getCurrentTexture().createView();

        const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: this.clearColor,
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        };

        const passEncoder =
            commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
