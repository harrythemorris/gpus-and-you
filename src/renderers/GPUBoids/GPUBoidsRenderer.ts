import { BaseRenderer } from "../Base/BaseRenderer";
import RenderShader from "./GPUBoidsRenderer.wgsl" with { type: "text" };
import ComputeShader from "./GPUBoidsCompute.wgsl" with { type: "text" };

const WORKGROUP_SIZE = 256;

const RENDER_SCALE = 0.004;
const SIM_SCALE = 0.1;

export class GPUBoidsRenderer extends BaseRenderer {
    device!: GPUDevice;
    context!: GPUCanvasContext;
    clearColor: [number, number, number, number] = [0.93, 0.99, 0.13, 1];
    renderPipeline!: GPURenderPipeline;
    computePipeline!: GPUComputePipeline;
    vertexBuffer!: GPUBuffer;
    boidBuffers: GPUBuffer[] = [];
    configBuffer!: GPUBuffer;
    numInstances: number = 500;

    // Boid parameters
    cohesionRadius: number = 0.3 * SIM_SCALE;
    alignmentRadius: number = 0.2 * SIM_SCALE;
    separationRadius: number = 0.1 * SIM_SCALE;
    cohesionWeight: number = 0.01;
    alignmentWeight: number = 0.05;
    separationWeight: number = 0.05;
    maxSpeed: number = 0.01 * SIM_SCALE;

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

        // Create the shaders
        const renderShader = this.device.createShaderModule({
            code: RenderShader,
            label: "render shader",
        });

        const computeShader = this.device.createShaderModule({
            code: ComputeShader,
            label: "compute shader",
        });

        // Create render pipeline
        this.renderPipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: renderShader,
                entryPoint: "vertexMain",
                buffers: [
                    {
                        // Triangle vertices
                        arrayStride: 8,
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
                        // Boid data
                        arrayStride: 16,
                        attributes: [
                            // Position. vec2f = 8 bytes
                            {
                                shaderLocation: 1,
                                offset: 0,
                                format: "float32x2",
                            },
                            // Velocity. vec2f = 8 bytes
                            {
                                shaderLocation: 2,
                                offset: 8,
                                format: "float32x2",
                            },
                        ],
                        stepMode: "instance",
                    },
                ],
            },
            fragment: {
                module: renderShader,
                entryPoint: "fragmentMain",
                targets: [{ format }],
            },
            primitive: {
                topology: "triangle-list",
            },
        });

        // Create compute pipeline
        this.computePipeline = this.device.createComputePipeline({
            layout: "auto",
            compute: {
                module: computeShader,
                entryPoint: "computeMain",
            },
        });

        // Create triangle vertices
        const vertices = new Float32Array([
            0.0,
            RENDER_SCALE,
            -RENDER_SCALE,
            -RENDER_SCALE,
            RENDER_SCALE,
            -RENDER_SCALE,
        ]);

        this.vertexBuffer = this.device.createBuffer({
            size: vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);

        // Initialize boid data
        const initialData = new Float32Array(this.numInstances * 4); // pos(2) + vel(2)
        for (let i = 0; i < this.numInstances; i++) {
            const rotation = Math.random() * Math.PI * 2;

            const velX = Math.cos(rotation) * this.maxSpeed;
            const velY = Math.sin(rotation) * this.maxSpeed;

            const baseIndex = i * 4;

            // Position
            initialData[baseIndex] = Math.random() * 2 - 1;
            initialData[baseIndex + 1] = Math.random() * 2 - 1;

            // Velocity
            initialData[baseIndex + 2] = velX;
            initialData[baseIndex + 3] = velY;
        }

        // Create double-buffered boid data
        for (let i = 0; i < 2; i++) {
            this.boidBuffers[i] = this.device.createBuffer({
                size: initialData.byteLength,
                usage:
                    GPUBufferUsage.STORAGE |
                    GPUBufferUsage.VERTEX |
                    GPUBufferUsage.COPY_DST,
            });
        }
        this.device.queue.writeBuffer(this.boidBuffers[0], 0, initialData);
        this.device.queue.writeBuffer(this.boidBuffers[1], 0, initialData);

        // Create config buffer
        const configData = new Float32Array([
            this.cohesionRadius,
            this.alignmentRadius,
            this.separationRadius,
            this.cohesionWeight,
            this.alignmentWeight,
            this.separationWeight,
            this.maxSpeed,
        ]);

        this.configBuffer = this.device.createBuffer({
            size: configData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.configBuffer, 0, configData);
    }

    destroy() {
        this.device?.destroy();
    }

    update() {
        const commandEncoder = this.device.createCommandEncoder();
        const computePass = commandEncoder.beginComputePass();

        computePass.setPipeline(this.computePipeline);
        computePass.setBindGroup(
            0,
            this.device.createBindGroup({
                layout: this.computePipeline.getBindGroupLayout(0),
                entries: [
                    {
                        binding: 0,
                        resource: { buffer: this.boidBuffers[0] },
                    },
                    {
                        binding: 1,
                        resource: { buffer: this.boidBuffers[1] },
                    },
                    {
                        binding: 2,
                        resource: { buffer: this.configBuffer },
                    },
                ],
            }),
        );

        const workgroupCount = Math.ceil(this.numInstances / WORKGROUP_SIZE);
        computePass.dispatchWorkgroups(workgroupCount);
        computePass.end();

        this.device.queue.submit([commandEncoder.finish()]);

        // Swap buffers
        [this.boidBuffers[0], this.boidBuffers[1]] = [
            this.boidBuffers[1],
            this.boidBuffers[0],
        ];
    }

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
        passEncoder.setPipeline(this.renderPipeline);
        passEncoder.setVertexBuffer(0, this.vertexBuffer);
        passEncoder.setVertexBuffer(1, this.boidBuffers[0]);
        passEncoder.draw(3, this.numInstances);
        passEncoder.end();

        this.device.queue.submit([commandEncoder.finish()]);
    }
}
