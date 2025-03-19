import { BaseRenderer } from "../Base/BaseRenderer";
import Shader from "./HelloWorldRenderer.wgsl" with { type: "text" };

export class HelloWorldRenderer extends BaseRenderer {
    device!: GPUDevice;
    context!: GPUCanvasContext;
    clearColor: [number, number, number, number] = [0.93, 0.99, 0.13, 1];
    pipeline!: GPURenderPipeline;
    vertexBuffer!: GPUBuffer;

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
                topology: "triangle-list",
            },
        });

        // Create vertex buffer
        const vertices = new Float32Array([
            // Position (x,y), Color (r,g,b)
            0.0,
            0.5,
            1.0,
            0.0,
            0.0, // Top vertex - red
            -0.5,
            -0.5,
            0.0,
            1.0,
            0.0, // Bottom left - green
            0.5,
            -0.5,
            0.0,
            0.0,
            1.0, // Bottom right - blue
        ]);

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
        passEncoder.draw(3);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
