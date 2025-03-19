import { BaseRenderer } from "../Base/BaseRenderer";
import Shader from "./PointsRenderer.wgsl" with { type: "text" };

export class PointsRenderer extends BaseRenderer {
    device!: GPUDevice;
    context!: GPUCanvasContext;
    clearColor: [number, number, number, number] = [0, 0, 0, 1];
    pipeline!: GPURenderPipeline;
    vertexBuffer!: GPUBuffer;
    numPoints: number = 100_000;

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

        // Create the shader
        const shader = this.device.createShaderModule({
            code: Shader,
        });

        // Create pipeline
        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: shader,
                entryPoint: "vertexMain",
                buffers: [
                    {
                        arrayStride: 20, // 2 floats for position + 3 floats for color = 5 floats * 4 bytes
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x2",
                            },
                            {
                                shaderLocation: 1,
                                offset: 8,
                                format: "float32x3",
                            },
                        ],
                    },
                ],
            },
            fragment: {
                module: shader,
                entryPoint: "fragmentMain",
                targets: [
                    {
                        format,
                    },
                ],
            },
            primitive: {
                topology: "point-list",
            },
        });

        // Create random points
        const vertices = new Float32Array(this.numPoints * 5); // 5 values per point (x,y,r,g,b)

        for (let i = 0; i < this.numPoints; i++) {
            const baseIndex = i * 5;
            // Random position between -1 and 1
            vertices[baseIndex] = Math.random() * 2 - 1; // x
            vertices[baseIndex + 1] = Math.random() * 2 - 1; // y
            // Random color
            vertices[baseIndex + 2] = Math.random(); // r
            vertices[baseIndex + 3] = Math.random(); // g
            vertices[baseIndex + 4] = Math.random(); // b
        }

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
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
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.draw(this.numPoints);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
