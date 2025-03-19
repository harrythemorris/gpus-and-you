import { BaseRenderer } from "../Base/BaseRenderer";
import Shader from "./InstancingRenderer.wgsl" with { type: "text" };

export class InstancingRenderer extends BaseRenderer {
    device!: GPUDevice;
    context!: GPUCanvasContext;
    clearColor: [number, number, number, number] = [0, 0, 0, 1];
    pipeline!: GPURenderPipeline;
    vertexBuffer!: GPUBuffer;
    instanceBuffer!: GPUBuffer;
    numInstances: number = 100_000;

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
                        // Triangle vertices
                        arrayStride: 8, // 2 floats for position * 4 bytes
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: "float32x2",
                            },
                        ],
                        stepMode: "vertex",
                    },
                    {
                        // Instance data
                        arrayStride: 24, // 2 floats position + 1 float rotation + 3 floats color = 6 floats * 4 bytes
                        attributes: [
                            {
                                shaderLocation: 1,
                                offset: 0,
                                format: "float32x2", // position
                            },
                            {
                                shaderLocation: 2,
                                offset: 8,
                                format: "float32", // rotation
                            },
                            {
                                shaderLocation: 3,
                                offset: 12,
                                format: "float32x3", // color
                            },
                        ],
                        stepMode: "instance",
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

        // Create triangle vertices
        const vertices = new Float32Array([
            0.0,
            0.05, // top
            -0.05,
            -0.05, // bottom left
            0.05,
            -0.05, // bottom right
        ]);

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

        // Create instance data
        const instanceData = new Float32Array(this.numInstances * 6); // 6 values per instance (x,y,rotation,r,g,b)

        for (let i = 0; i < this.numInstances; i++) {
            const baseIndex = i * 6;
            // Random position between -1 and 1
            instanceData[baseIndex] = Math.random() * 2 - 1; // x
            instanceData[baseIndex + 1] = Math.random() * 2 - 1; // y
            // Random rotation between 0 and 2π
            instanceData[baseIndex + 2] = Math.random() * Math.PI * 2;
            // Random color
            instanceData[baseIndex + 3] = Math.random(); // r
            instanceData[baseIndex + 4] = Math.random(); // g
            instanceData[baseIndex + 5] = Math.random(); // b
        }

        this.instanceBuffer = this.device.createBuffer({
            size: instanceData.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.instanceBuffer, 0, instanceData);
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
        passEncoder.setVertexBuffer(1, this.instanceBuffer);
        passEncoder.draw(3, this.numInstances); // 3 vertices per triangle, numInstances instances
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
